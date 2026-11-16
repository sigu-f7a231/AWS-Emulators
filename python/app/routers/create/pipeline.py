"""Pipeline - Create: SNS への購読登録 / ブロードキャスト配信"""
from fastapi import APIRouter, HTTPException

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.services.mail_service import ensure_delivery_mode

from app.schemas.pipeline import PipelineBroadcastRequest, SubscribeEmailRequest, SubscribeSqsRequest
from app.services.pipeline import broadcast_topic_pipeline, link_sns_to_sqs, subscribe_email_to_topic

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.post(
    "/api/pipeline/subscribe-email",
    summary="[Pipeline] トピックにメールアドレスを登録",
    description="AWS と同じく承認待ちで登録し、確認メールを送ります。承認されるまで配信されません。",
)
def add_email_subscription_api(req: SubscribeEmailRequest):
    try:
        ensure_delivery_mode(req.delivery_mode)
        res = subscribe_email_to_topic(req.topic_arn, req.email, req.delivery_mode)
        msg = (f"'{req.email}' に確認メールを送信しました（承認待ち）" if res["status"] != "confirmed"
               else f"'{req.email}' はすでに承認済みです")
        return {"message": msg, "detail": res}
    except Exception as e:
        raise to_http(e)


@router.post("/api/pipeline/subscribe-sqs", summary="[Pipeline] トピックに SQS キューを紐付け")
def add_sqs_subscription_api(req: SubscribeSqsRequest):
    try:
        res = link_sns_to_sqs(req.topic_arn, req.queue_name)
        return {"message": f"SNSトピックにSQSキュー '{req.queue_name}' を紐付けました", "detail": res}
    except Exception as e:
        raise to_http(e)


@router.post(
    "/api/pipeline/broadcast",
    summary="[Pipeline] ブロードキャスト配信",
    description="SNS に発行し、**承認済み**のメール購読へメールを送信します（承認待ちは `email_skipped_pending` に入り送られません）。紐付いた SQS キューへは SNS が自動で配信します（このAPIからは送りません）。",
)
def broadcast_pipeline_message(req: PipelineBroadcastRequest):
    try:
        ensure_delivery_mode(req.delivery_mode)  # SMTP 未設定なら配信前に 400
    except Exception as e:
        raise to_http(e)
    try:
        res = broadcast_topic_pipeline(
            topic_arn=req.topic_arn, subject=req.subject, message_body=req.message, delivery_mode=req.delivery_mode
        )
        return {
            "status": "success",
            "message": "SNSトピックから全メールサブスクリプションおよび連携SQSキューへ配信が完了しました！",
            "result": res,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
