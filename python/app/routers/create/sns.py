"""SNS - Create: トピック作成 / サブスクリプション登録 / メッセージ発行"""
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Path

from app.aws_client import get_client
from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.utils import topic_name_of
from app.schemas.sns import (
    CreateTopicRequest,
    PublishFlatRequest,
    PublishTopicRequest,
    SubscribeFlatRequest,
    SubscribeSqsFlatRequest,
    SubscribeTopicRequest,
)
from app.services.mail_service import ensure_delivery_mode, send_email
from app.services.pipeline import link_sns_to_sqs

router = APIRouter(responses=VALIDATION_RESPONSES)

TOPIC_ARN = Path(..., description="トピック ARN（`arn:aws:sns:...`。スラッシュを含んでもよい）")


def _dispatch_emails(sns, topic_arn: str, subject: str, message: str, delivery_mode=None) -> List[Dict]:
    """トピックの email サブスクリプション宛てにメールを送る（エミュレータは実配信しないため）"""
    dispatched: List[Dict] = []
    try:
        subs_res = sns.list_subscriptions_by_topic(TopicArn=topic_arn)
        for s in subs_res.get("Subscriptions", []):
            if s.get("Protocol") == "email" and s.get("Endpoint"):
                dispatched.append(send_email(
                    to_address=s["Endpoint"],
                    subject=subject,
                    body=message,
                    source="sns",
                    source_detail=f"Topic: {topic_name_of(topic_arn)}",
                    delivery_mode=delivery_mode,
                ))
    except Exception:
        pass
    return dispatched


@router.post("/api/sns/topics", summary="[SNS] トピックを作成")
def create_topic(req: CreateTopicRequest):
    try:
        sns = get_client("sns")
        res = sns.create_topic(Name=req.topic_name)
        return {"topic_arn": res.get("TopicArn"), "message": f"Topic '{req.topic_name}' created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/sns/topics/{topic_arn:path}/subscribe", summary="[SNS] サブスクリプションを登録")
def subscribe_topic(req: SubscribeTopicRequest, topic_arn: str = TOPIC_ARN):
    try:
        sns = get_client("sns")
        res = sns.subscribe(
            TopicArn=topic_arn,
            Protocol=req.protocol,
            Endpoint=req.endpoint,
            ReturnSubscriptionArn=True,
        )
        return {
            "subscription_arn": res.get("SubscriptionArn"),
            "message": f"Subscribed {req.endpoint} ({req.protocol}) to topic",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/api/sns/topics/{topic_arn:path}/publish",
    summary="[SNS] メッセージを発行",
    description="発行後、トピックの email サブスクライバー宛てにメールを送信します（SMTP 設定が有効なら実送信）。",
)
def publish_topic_message(req: PublishTopicRequest, topic_arn: str = TOPIC_ARN):
    try:
        ensure_delivery_mode(req.delivery_mode)  # SMTP 未設定なら SNS に発行する前に 400
    except Exception as e:
        raise to_http(e)
    try:
        sns = get_client("sns")
        res = sns.publish(TopicArn=topic_arn, Subject=req.subject, Message=req.message)
        dispatched = _dispatch_emails(
            sns, topic_arn, f"[SNS: {topic_name_of(topic_arn)}] {req.subject}", req.message, req.delivery_mode
        )
        return {
            "message_id": res.get("MessageId"),
            "dispatched_emails": dispatched,
            "message": f"Published to {topic_arn}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/sns/subscribe", summary="[SNS] サブスクリプションを登録（フラット版）")
def subscribe_flat(req: SubscribeFlatRequest):
    try:
        sns = get_client("sns")
        res = sns.subscribe(
            TopicArn=req.topic_arn,
            Protocol=req.protocol,
            Endpoint=req.endpoint,
            ReturnSubscriptionArn=True,
        )
        return {"subscription_arn": res.get("SubscriptionArn"), "message": "登録完了"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/sns/subscribe-sqs", summary="[SNS] SQS キューをトピックに紐付け（フラット版）")
def subscribe_sqs_flat(req: SubscribeSqsFlatRequest):
    try:
        res = link_sns_to_sqs(req.topic_arn, req.queue_url.split("/")[-1])
        return {"message": "SQSキューを紐付けました", "detail": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/api/sns/publish",
    summary="[SNS] メッセージを発行（フラット版）",
    description="発行後、トピックの email サブスクライバー宛てにメールを送信します（SMTP 設定が有効なら実送信）。",
)
def publish_flat(req: PublishFlatRequest):
    try:
        ensure_delivery_mode(req.delivery_mode)  # SMTP 未設定なら SNS に発行する前に 400
    except Exception as e:
        raise to_http(e)
    try:
        sns = get_client("sns")
        res = sns.publish(TopicArn=req.topic_arn, Subject=req.subject, Message=req.message)
        dispatched = _dispatch_emails(sns, req.topic_arn, f"[SNS] {req.subject}", req.message, req.delivery_mode)
        return {"message_id": res.get("MessageId"), "dispatched_emails": dispatched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
