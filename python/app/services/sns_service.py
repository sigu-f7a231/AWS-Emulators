"""
SNS の購読とメール配信（AWS の SNS と同じ流れ）

AWS の email / email-json 購読の流れ:
  1. Subscribe すると購読は「承認待ち（PendingConfirmation）」になり、確認メールが届く
  2. 確認メールのリンク（ConfirmSubscription）を開くと「承認済み」になる。リンクの有効期限は 3 日
  3. 発行（Publish）されたメッセージは承認済みの購読にだけ配信される。承認待ちには届かない
  4. 通知メールには配信停止（Unsubscribe）リンクが付く

エミュレータは実際にはメールを送らないため、承認状態と確認トークンはこのアプリが管理し、
メールは mail_service（SMTP または擬似送信）で送る。SQS など他のプロトコルの配信は SNS（エミュレータ）に任せる。
"""
import json
import os
import secrets
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app import config
from app.aws_client import get_client
from app.services.mail_service import send_email

STORE_FILE = os.path.join(config.DATA_DIR, "sns_subscriptions.json")
EMAIL_PROTOCOLS = ("email", "email-json")
TOKEN_TTL = timedelta(days=3)  # AWS の確認リンクの有効期限と同じ

PENDING = "pending_confirmation"
CONFIRMED = "confirmed"

_lock = threading.RLock()


class SubscriptionError(ValueError):
    """承認できない・再送できないなど（HTTP 400）"""


# --------------------------------------------------------------------------
# 保存（コンテナ内のみ）
# --------------------------------------------------------------------------
def _load() -> Dict[str, Dict[str, Any]]:
    with _lock:
        if os.path.exists(STORE_FILE):
            try:
                with open(STORE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}


def _save(data: Dict[str, Dict[str, Any]]) -> None:
    with _lock:
        os.makedirs(os.path.dirname(STORE_FILE) or ".", exist_ok=True)
        tmp = STORE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, STORE_FILE)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _topic_name(topic_arn: str) -> str:
    return topic_arn.split(":")[-1]


# --------------------------------------------------------------------------
# トピック
# --------------------------------------------------------------------------
DEFAULT_SENDER_NAME = "AWS Notifications"  # 表示名が無いときの送信者名（AWS と同じ）


def create_topic(name: str, topic_type: str = "standard", display_name: Optional[str] = None,
                 content_based_deduplication: bool = False) -> Dict[str, Any]:
    """
    CreateTopic（AWS コンソールの「タイプ / 名前 / 表示名」と同じ）。
    FIFO は名前の末尾が .fifo である必要があるので、無ければ付ける。名前の文字種などの検証は SNS に任せる。
    """
    name = (name or "").strip()
    attrs: Dict[str, str] = {}
    if topic_type == "fifo":
        if not name.endswith(".fifo"):
            name += ".fifo"
        attrs["FifoTopic"] = "true"
        if content_based_deduplication:
            attrs["ContentBasedDeduplication"] = "true"
    if display_name and display_name.strip():
        attrs["DisplayName"] = display_name.strip()
    kwargs: Dict[str, Any] = {"Name": name}
    if attrs:
        kwargs["Attributes"] = attrs
    arn = get_client("sns").create_topic(**kwargs).get("TopicArn")
    return {"topic_arn": arn, "name": name, "type": topic_type, "display_name": attrs.get("DisplayName", "")}


def topic_info(topic_arn: str) -> Dict[str, Any]:
    """トピックのタイプ・表示名など（GetTopicAttributes）"""
    try:
        a = get_client("sns").get_topic_attributes(TopicArn=topic_arn).get("Attributes", {})
    except Exception:
        a = {}
    fifo = str(a.get("FifoTopic", "")).lower() == "true" or topic_arn.endswith(".fifo")
    return {
        "arn": topic_arn,
        "name": _topic_name(topic_arn),
        "type": "fifo" if fifo else "standard",
        "display_name": a.get("DisplayName", ""),
        "content_based_deduplication": str(a.get("ContentBasedDeduplication", "")).lower() == "true",
    }


def _sender_name(topic_arn: str) -> str:
    return topic_info(topic_arn)["display_name"] or DEFAULT_SENDER_NAME


# --------------------------------------------------------------------------
# 一覧（ページングして全件取得）
# --------------------------------------------------------------------------
def list_topics(with_attributes: bool = False) -> List[Dict[str, Any]]:
    sns = get_client("sns")
    topics: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {}
    while True:
        res = sns.list_topics(**kwargs)
        for t in res.get("Topics", []):
            arn = t["TopicArn"]
            topics.append(topic_info(arn) if with_attributes else {"arn": arn, "name": _topic_name(arn)})
        if not res.get("NextToken"):
            return topics
        kwargs["NextToken"] = res["NextToken"]


def list_subscriptions_by_topic(topic_arn: str) -> List[Dict[str, Any]]:
    """購読一覧。email 系には承認状態（status）を付ける"""
    sns = get_client("sns")
    store = _load()
    subs: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {"TopicArn": topic_arn}
    while True:
        res = sns.list_subscriptions_by_topic(**kwargs)
        for s in res.get("Subscriptions", []):
            arn = s.get("SubscriptionArn")
            proto = s.get("Protocol")
            subs.append({
                "arn": arn,
                "protocol": proto,
                "endpoint": s.get("Endpoint", ""),
                "status": status_of(arn, proto, store),
            })
        if not res.get("NextToken"):
            return subs
        kwargs["NextToken"] = res["NextToken"]


def status_of(subscription_arn: str, protocol: str, store: Optional[Dict] = None) -> str:
    """email 系は承認されるまで pending。SQS など他のプロトコルは（同一アカウントなので）自動で承認済み"""
    if protocol not in EMAIL_PROTOCOLS:
        return CONFIRMED
    store = store if store is not None else _load()
    return (store.get(subscription_arn) or {}).get("status", PENDING)


# --------------------------------------------------------------------------
# 購読・承認・再送・解除
# --------------------------------------------------------------------------
def _confirm_url(token: str, topic_arn: str) -> str:
    from urllib.parse import urlencode
    return f"{config.PUBLIC_BASE_URL}/sns/confirm?{urlencode({'TopicArn': topic_arn, 'Token': token})}"


def _unsubscribe_url(subscription_arn: str, token: str) -> str:
    from urllib.parse import urlencode
    return f"{config.PUBLIC_BASE_URL}/sns/unsubscribe?{urlencode({'SubscriptionArn': subscription_arn, 'Token': token})}"


def _send_confirmation(entry: Dict[str, Any], delivery_mode: Optional[str]) -> Dict:
    url = _confirm_url(entry["token"], entry["topic_arn"])
    body = (
        "You have chosen to subscribe to the topic:\n"
        f"{entry['topic_arn']}\n\n"
        "To confirm this subscription, click or visit the link below (If this was in error no action is necessary):\n"
        f"{url}\n\n"
        "このトピックの購読を承認するには、上のリンクを開いてください（心当たりがなければ何もしなくて構いません）。\n"
        "リンクの有効期限は 3 日です。承認するまで、このトピックのメッセージは届きません。\n\n"
        "Please do not reply directly to this email."
    )
    return send_email(
        to_address=entry["endpoint"],
        subject="AWS Notification - Subscription Confirmation",
        body=body,
        source="sns",
        source_detail=f"Subscription confirmation: {_topic_name(entry['topic_arn'])}",
        delivery_mode=delivery_mode,
        from_name=_sender_name(entry["topic_arn"]),
    )


def subscribe(topic_arn: str, protocol: str, endpoint: str, delivery_mode: Optional[str] = None) -> Dict[str, Any]:
    """
    Subscribe。email 系は承認待ちにして確認メールを送る（承認済みの同じ購読なら送らない。AWS と同じ）。
    同じアドレスで承認待ちのまま再度 Subscribe した場合は、確認メールを送り直す。
    """
    if protocol in EMAIL_PROTOCOLS and topic_info(topic_arn)["type"] == "fifo":
        # AWS と同じ: FIFO トピックは Eメール のサブスクリプションに対応していない
        raise SubscriptionError("FIFO トピックは Eメール のサブスクリプションに対応していません（AWS と同じ）。スタンダードトピックを使ってください")
    sns = get_client("sns")
    res = sns.subscribe(TopicArn=topic_arn, Protocol=protocol, Endpoint=endpoint, ReturnSubscriptionArn=True)
    arn = res.get("SubscriptionArn")
    if protocol not in EMAIL_PROTOCOLS:
        return {"subscription_arn": arn, "status": CONFIRMED}

    with _lock:
        store = _load()
        entry = store.get(arn)
        if entry and entry.get("status") == CONFIRMED:
            return {"subscription_arn": arn, "status": CONFIRMED, "confirmation_email": None}
        entry = {
            "topic_arn": topic_arn,
            "protocol": protocol,
            "endpoint": endpoint,
            "status": PENDING,
            "token": secrets.token_hex(32),
            "token_expires_at": _iso(_now() + TOKEN_TTL),
            "unsubscribe_token": (entry or {}).get("unsubscribe_token") or secrets.token_hex(16),
            "created_at": (entry or {}).get("created_at") or _iso(_now()),
        }
        store[arn] = entry
        _save(store)
    mail = _send_confirmation(entry, delivery_mode)
    return {"subscription_arn": arn, "status": PENDING, "confirmation_email": mail}


def resend_confirmation(subscription_arn: str, delivery_mode: Optional[str] = None) -> Dict[str, Any]:
    """承認待ちの購読に確認メールを送り直す（新しいリンクを発行し、古いリンクは無効になる）"""
    with _lock:
        store = _load()
        entry = store.get(subscription_arn)
        if entry is None:
            # このアプリの外で作られた購読: SNS から情報を取る
            attrs = get_client("sns").get_subscription_attributes(SubscriptionArn=subscription_arn).get("Attributes", {})
            if attrs.get("Protocol") not in EMAIL_PROTOCOLS:
                raise SubscriptionError("email / email-json 以外の購読には確認メールはありません")
            entry = {
                "topic_arn": attrs.get("TopicArn"),
                "protocol": attrs.get("Protocol"),
                "endpoint": attrs.get("Endpoint"),
                "status": PENDING,
                "unsubscribe_token": secrets.token_hex(16),
                "created_at": _iso(_now()),
            }
        if entry.get("status") == CONFIRMED:
            raise SubscriptionError("この購読は承認済みです")
        entry["token"] = secrets.token_hex(32)
        entry["token_expires_at"] = _iso(_now() + TOKEN_TTL)
        store[subscription_arn] = entry
        _save(store)
    mail = _send_confirmation(entry, delivery_mode)
    return {"subscription_arn": subscription_arn, "status": PENDING, "confirmation_email": mail}


def confirm_subscription(token: str, topic_arn: Optional[str] = None) -> Dict[str, Any]:
    """ConfirmSubscription。確認メールのリンクから呼ばれる"""
    token = (token or "").strip()
    with _lock:
        store = _load()
        match = next(((arn, e) for arn, e in store.items() if e.get("token") and secrets.compare_digest(e["token"], token)), None)
        if not match:
            raise SubscriptionError("確認リンクが無効です（すでに使われたか、新しいリンクが発行されています）")
        arn, entry = match
        if topic_arn and topic_arn != entry["topic_arn"]:
            raise SubscriptionError("確認リンクのトピックが一致しません")
        if entry.get("status") == CONFIRMED:
            return {"subscription_arn": arn, "status": CONFIRMED, "topic_arn": entry["topic_arn"], "endpoint": entry["endpoint"]}
        expires = datetime.strptime(entry["token_expires_at"], "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
        if _now() > expires:
            raise SubscriptionError("確認リンクの有効期限（3 日）が切れています。確認メールを再送してください")
        # 購読が SNS 側でまだ存在するか
        if not any(s["arn"] == arn for s in list_subscriptions_by_topic(entry["topic_arn"])):
            raise SubscriptionError("この購読はすでに削除されています")
        entry["status"] = CONFIRMED
        entry["confirmed_at"] = _iso(_now())
        entry.pop("token", None)
        entry.pop("token_expires_at", None)
        store[arn] = entry
        _save(store)
    return {"subscription_arn": arn, "status": CONFIRMED, "topic_arn": entry["topic_arn"], "endpoint": entry["endpoint"]}


def unsubscribe(subscription_arn: str) -> Dict[str, Any]:
    get_client("sns").unsubscribe(SubscriptionArn=subscription_arn)
    with _lock:
        store = _load()
        if store.pop(subscription_arn, None) is not None:
            _save(store)
    return {"message": "サブスクリプションを解除・削除しました", "subscription_arn": subscription_arn}


def unsubscribe_with_token(subscription_arn: str, token: str) -> Dict[str, Any]:
    """通知メールの配信停止リンクから呼ばれる"""
    entry = _load().get(subscription_arn)
    if not entry or not secrets.compare_digest(entry.get("unsubscribe_token", ""), (token or "").strip()):
        raise SubscriptionError("配信停止リンクが無効です（すでに解除済みの可能性があります）")
    res = unsubscribe(subscription_arn)
    res.update({"topic_arn": entry["topic_arn"], "endpoint": entry["endpoint"]})
    return res


def forget_topic(topic_arn: str) -> None:
    """トピック削除時: 購読も消えるので保存している状態も消す"""
    with _lock:
        store = _load()
        left = {k: v for k, v in store.items() if v.get("topic_arn") != topic_arn}
        if len(left) != len(store):
            _save(left)


# --------------------------------------------------------------------------
# 配信
# --------------------------------------------------------------------------
def deliver_to_email_subscribers(
    topic_arn: str, subject: Optional[str], message: str, message_id: Optional[str],
    delivery_mode: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Publish 後に呼ぶ。承認済みの email / email-json 購読にだけ送る（承認待ちはスキップ。AWS と同じ）。
    - email     : 件名は Subject（無ければ "AWS Notification Message"）、本文はメッセージ ＋ 配信停止リンク
    - email-json: 本文は SNS の通知 JSON
    """
    store = _load()
    sender = _sender_name(topic_arn)
    delivered: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    for s in list_subscriptions_by_topic(topic_arn):
        if s["protocol"] not in EMAIL_PROTOCOLS or not s["endpoint"]:
            continue
        if s["status"] != CONFIRMED:
            skipped.append({"email": s["endpoint"], "subscription_arn": s["arn"], "status": s["status"]})
            continue
        entry = store.get(s["arn"], {})
        unsub_url = _unsubscribe_url(s["arn"], entry.get("unsubscribe_token", ""))
        mail_subject = subject or "AWS Notification Message"
        if s["protocol"] == "email-json":
            body = json.dumps({
                "Type": "Notification",
                "MessageId": message_id or str(uuid.uuid4()),
                "TopicArn": topic_arn,
                "Subject": subject,
                "Message": message,
                "Timestamp": _iso(_now()),
                "UnsubscribeURL": unsub_url,
            }, ensure_ascii=False, indent=2)
        else:
            body = (
                f"{message}\n\n--\n"
                "If you wish to stop receiving notifications from this topic, please click or visit the link below to unsubscribe:\n"
                f"{unsub_url}\n\n"
                "このトピックの配信を停止するには、上のリンクを開いてください。\n"
                "Please do not reply directly to this email."
            )
        rec = send_email(
            to_address=s["endpoint"],
            subject=mail_subject,
            body=body,
            source="sns",
            source_detail=f"Topic: {_topic_name(topic_arn)}",
            delivery_mode=delivery_mode,
            from_name=sender,
        )
        delivered.append({
            "email": s["endpoint"], "subscription_arn": s["arn"],
            "email_id": rec["id"], "status": rec["status"], "error": rec.get("error"),
        })
    return {"delivered": delivered, "skipped_pending": skipped}
