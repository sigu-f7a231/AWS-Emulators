"""SNS - Create: トピック作成 / 購読（Subscribe）/ 確認メール再送 / メッセージ発行（Publish）"""
from fastapi import APIRouter, Path

from app.aws_client import get_client
from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.sns import (
    CreateTopicRequest,
    PublishFlatRequest,
    PublishTopicRequest,
    ResendConfirmationRequest,
    SubscribeFlatRequest,
    SubscribeSqsFlatRequest,
    SubscribeTopicRequest,
)
from app.services import sns_service
from app.services.mail_service import ensure_delivery_mode
from app.services.pipeline import link_sns_to_sqs
from app.utils import topic_name_of

router = APIRouter(responses=VALIDATION_RESPONSES)

TOPIC_ARN = Path(..., description="トピック ARN（`arn:aws:sns:...`。スラッシュを含んでもよい）")
SUBSCRIBE_NOTE = (
    "AWS と同じく、email / email-json の購読は **承認待ち（pending_confirmation）** で作成され、確認メールが送られます。"
    "確認メールのリンクを開く（ConfirmSubscription）まで、メッセージは配信されません。"
    "sqs などその他のプロトコルはすぐに承認済みになります。"
)
PUBLISH_NOTE = (
    "SNS に発行します。SQS への配信は SNS が自動で行います。"
    "email は **承認済みの購読にだけ** メールを送ります（承認待ちは `skipped_pending` に入り、送られません）。"
    "件名は Subject（空なら `AWS Notification Message`）、本文の末尾に配信停止リンクが付きます。"
)


def _publish(topic_arn: str, subject: str, message: str, delivery_mode, group_id=None, dedup_id=None):
    try:
        ensure_delivery_mode(delivery_mode)  # SMTP 未設定なら SNS に発行する前に 400
    except Exception as e:
        raise to_http(e)
    try:
        sns = get_client("sns")
        kwargs = {"TopicArn": topic_arn, "Message": message}
        if subject:
            kwargs["Subject"] = subject
        if group_id:
            kwargs["MessageGroupId"] = group_id  # FIFO トピックでは必須（無ければ SNS がエラーにする）
        if dedup_id:
            kwargs["MessageDeduplicationId"] = dedup_id
        message_id = sns.publish(**kwargs).get("MessageId")
        emails = sns_service.deliver_to_email_subscribers(topic_arn, subject, message, message_id, delivery_mode)
        return {
            "message_id": message_id,
            "dispatched_emails": emails["delivered"],
            "skipped_pending": emails["skipped_pending"],
            "message": f"Published to {topic_arn}",
        }
    except Exception as e:
        raise to_http(e)


@router.post(
    "/api/sns/topics",
    summary="[SNS] トピックを作成（CreateTopic）",
    description=(
        "AWS コンソールと同じく、タイプ（スタンダード / FIFO）・名前・表示名を指定します。\n\n"
        "- FIFO は名前の末尾が `.fifo`（無ければ付けます）。FIFO トピックは Eメール の購読に対応していません\n"
        "- 表示名はメール購読への送信者名に使われます（未設定なら `AWS Notifications`）"
    ),
)
def create_topic(req: CreateTopicRequest):
    try:
        t = sns_service.create_topic(req.topic_name, req.topic_type, req.display_name, req.content_based_deduplication)
        return {**t, "message": f"Topic '{t['name']}' created"}
    except Exception as e:
        raise to_http(e)


@router.post("/api/sns/topics/{topic_arn:path}/subscribe", summary="[SNS] 購読を登録（Subscribe）", description=SUBSCRIBE_NOTE)
def subscribe_topic(req: SubscribeTopicRequest, topic_arn: str = TOPIC_ARN):
    try:
        ensure_delivery_mode(req.delivery_mode)
        res = sns_service.subscribe(topic_arn, req.protocol, req.endpoint, req.delivery_mode)
        return {**res, "message": f"Subscribed {req.endpoint} ({req.protocol}) to topic"}
    except Exception as e:
        raise to_http(e)


@router.post("/api/sns/topics/{topic_arn:path}/publish", summary="[SNS] メッセージを発行（Publish）", description=PUBLISH_NOTE)
def publish_topic_message(req: PublishTopicRequest, topic_arn: str = TOPIC_ARN):
    return _publish(topic_arn, req.subject, req.message, req.delivery_mode, req.message_group_id, req.message_deduplication_id)


@router.post("/api/sns/subscribe", summary="[SNS] 購読を登録（フラット版・Subscribe）", description=SUBSCRIBE_NOTE)
def subscribe_flat(req: SubscribeFlatRequest):
    try:
        ensure_delivery_mode(req.delivery_mode)
        res = sns_service.subscribe(req.topic_arn, req.protocol, req.endpoint, req.delivery_mode)
        msg = "確認メールを送信しました（承認待ち）" if res["status"] == sns_service.PENDING else "登録完了"
        return {**res, "message": msg}
    except Exception as e:
        raise to_http(e)


@router.post("/api/sns/subscribe-sqs", summary="[SNS] SQS キューをトピックに紐付け（フラット版）",
             description="キューを購読させ、キューポリシーに「このトピックからの送信を許可」を **追記** します（既存のポリシーは消しません）。")
def subscribe_sqs_flat(req: SubscribeSqsFlatRequest):
    try:
        res = link_sns_to_sqs(req.topic_arn, req.queue_url.split("/")[-1])
        return {"message": "SQSキューを紐付けました", "detail": res}
    except Exception as e:
        raise to_http(e)


@router.post("/api/sns/publish", summary="[SNS] メッセージを発行（フラット版・Publish）", description=PUBLISH_NOTE)
def publish_flat(req: PublishFlatRequest):
    return _publish(req.topic_arn, req.subject, req.message, req.delivery_mode, req.message_group_id, req.message_deduplication_id)


@router.post(
    "/api/sns/subscriptions/{subscription_arn:path}/resend-confirmation",
    summary="[SNS] 確認メールを再送",
    description="承認待ちの email 購読に確認メールを送り直します（AWS コンソールの「Request confirmation」相当）。新しいリンクを発行し、古いリンクは使えなくなります。",
)
def resend_confirmation(req: ResendConfirmationRequest, subscription_arn: str = Path(..., description="サブスクリプション ARN")):
    try:
        ensure_delivery_mode(req.delivery_mode)
        return sns_service.resend_confirmation(subscription_arn, req.delivery_mode)
    except Exception as e:
        raise to_http(e)
