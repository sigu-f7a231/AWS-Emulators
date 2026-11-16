"""SNS → Email / SQS パイプライン"""
import hashlib
import json
from typing import Any, Dict, List, Optional

from app.aws_client import get_client
from app.services import sns_service


def _sends_topic(statement: Dict[str, Any], topic_arn: str) -> bool:
    """このステートメントが topic_arn からの sqs:SendMessage を許可しているか"""
    if statement.get("Effect") != "Allow":
        return False
    actions = statement.get("Action", [])
    actions = [actions] if isinstance(actions, str) else actions
    if not any(a.lower() in ("sqs:sendmessage", "sqs:*", "*") for a in actions):
        return False
    cond = statement.get("Condition", {})
    for op in ("ArnEquals", "ArnLike", "StringEquals"):
        src = cond.get(op, {}).get("aws:SourceArn")
        if src == topic_arn or (isinstance(src, list) and topic_arn in src):
            return True
    return False


def allow_topic_in_queue_policy(queue_url: str, queue_arn: str, topic_arn: str) -> bool:
    """
    キューポリシーに「このトピックからの sqs:SendMessage を許可」を追記する。
    既存のステートメントは消さない（上書きしない）。すでに許可済みなら何もしない。
    戻り値: 追記したら True
    """
    sqs = get_client("sqs")
    attrs = sqs.get_queue_attributes(QueueUrl=queue_url, AttributeNames=["Policy"]).get("Attributes", {})
    raw = attrs.get("Policy")
    policy: Dict[str, Any] = json.loads(raw) if raw else {"Version": "2012-10-17", "Statement": []}
    statements = policy.get("Statement", [])
    if isinstance(statements, dict):
        statements = [statements]
    if any(_sends_topic(st, topic_arn) for st in statements):
        return False

    sid_base = "AllowSNS-" + "".join(ch if ch.isalnum() else "-" for ch in topic_arn.split(":")[-1])
    sid = f"{sid_base}-{hashlib.sha1(topic_arn.encode()).hexdigest()[:8]}"
    statements.append({
        "Sid": sid,
        "Effect": "Allow",
        "Principal": {"Service": "sns.amazonaws.com"},
        "Action": "sqs:SendMessage",
        "Resource": queue_arn,
        "Condition": {"ArnEquals": {"aws:SourceArn": topic_arn}},
    })
    policy["Statement"] = statements
    policy.setdefault("Version", "2012-10-17")
    sqs.set_queue_attributes(QueueUrl=queue_url, Attributes={"Policy": json.dumps(policy)})
    return True


def link_sns_to_sqs(topic_arn: str, queue_name: str) -> Dict:
    """SQS キューをトピックに購読させ、キューポリシーに配信許可を追記する"""
    sqs = get_client("sqs")
    queue_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
    queue_arn = sqs.get_queue_attributes(QueueUrl=queue_url, AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]

    sub = sns_service.subscribe(topic_arn, "sqs", queue_arn)
    policy_added = allow_topic_in_queue_policy(queue_url, queue_arn, topic_arn)
    return {
        "topic_arn": topic_arn,
        "queue_name": queue_name,
        "queue_arn": queue_arn,
        "subscription_arn": sub["subscription_arn"],
        "policy_statement_added": policy_added,
    }


def subscribe_email_to_topic(topic_arn: str, email: str, delivery_mode: Optional[str] = None) -> Dict:
    """メールアドレスを購読させる。承認待ちになり、確認メールが送られる"""
    res = sns_service.subscribe(topic_arn, "email", email, delivery_mode)
    return {
        "topic_arn": topic_arn,
        "email": email,
        "subscription_arn": res["subscription_arn"],
        "status": res["status"],
        "confirmation_email_status": (res.get("confirmation_email") or {}).get("status"),
    }


def unsubscribe_arn(subscription_arn: str) -> Dict:
    return sns_service.unsubscribe(subscription_arn)


def _list_queues() -> List[Dict[str, str]]:
    sqs = get_client("sqs")
    queues: List[Dict[str, str]] = []
    kwargs: Dict[str, Any] = {"MaxResults": 1000}
    while True:
        res = sqs.list_queues(**kwargs)
        queues.extend({"name": u.split("/")[-1], "url": u} for u in res.get("QueueUrls", []))
        if not res.get("NextToken"):
            return queues
        kwargs["NextToken"] = res["NextToken"]


def get_pipeline_overview() -> Dict:
    """トピック・キュー・トピックごとの購読（email は承認状態つき）"""
    topics = sns_service.list_topics()
    pipelines = []
    for t in topics:
        email_subs, sqs_subs = [], []
        try:
            for s in sns_service.list_subscriptions_by_topic(t["arn"]):
                if s["protocol"] in sns_service.EMAIL_PROTOCOLS:
                    email_subs.append({"subscription_arn": s["arn"], "email": s["endpoint"], "protocol": s["protocol"], "status": s["status"]})
                elif s["protocol"] == "sqs":
                    sqs_subs.append({"subscription_arn": s["arn"], "queue_name": s["endpoint"].split(":")[-1], "queue_arn": s["endpoint"], "status": s["status"]})
        except Exception:
            pass
        pipelines.append({
            "topic_arn": t["arn"],
            "topic_name": t["name"],
            "email_subscriptions": email_subs,
            "sqs_subscriptions": sqs_subs,
        })
    return {"topics": topics, "queues": _list_queues(), "pipelines": pipelines}


def broadcast_topic_pipeline(topic_arn: str, subject: str, message_body: str, delivery_mode: Optional[str] = None) -> Dict:
    """
    SNS に発行する。
    - SQS への配信は SNS が自動で行う（ここでは送らない）
    - email は承認済みの購読にだけ、このアプリがメールを送る（承認待ちはスキップ）
    """
    sns = get_client("sns")
    message_id = sns.publish(TopicArn=topic_arn, Subject=subject, Message=message_body).get("MessageId")
    emails = sns_service.deliver_to_email_subscribers(topic_arn, subject, message_body, message_id, delivery_mode)
    sqs_deliveries = [
        {"queue_name": s["endpoint"].split(":")[-1], "queue_arn": s["endpoint"], "status": "delivered_by_sns"}
        for s in sns_service.list_subscriptions_by_topic(topic_arn) if s["protocol"] == "sqs"
    ]
    return {
        "topic_arn": topic_arn,
        "message_id": message_id,
        "email_deliveries": emails["delivered"],
        "email_skipped_pending": emails["skipped_pending"],
        "sqs_deliveries": sqs_deliveries,
    }
