"""SNS - Delete: トピック削除 / 配信停止リンクによる購読解除"""
from fastapi import APIRouter, Path

from app.aws_client import get_client
from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.sns import UnsubscribeWithTokenRequest
from app.services import sns_service

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.delete("/api/sns/topics/{topic_arn:path}", summary="[SNS] トピックを削除", description="トピックの購読もすべて削除されます。")
def delete_topic(topic_arn: str = Path(..., description="トピック ARN")):
    try:
        get_client("sns").delete_topic(TopicArn=topic_arn)
        sns_service.forget_topic(topic_arn)
        return {"message": f"Topic '{topic_arn}' deleted"}
    except Exception as e:
        raise to_http(e)


@router.post(
    "/api/sns/unsubscribe",
    summary="[SNS] 配信停止リンクで購読を解除（Unsubscribe）",
    description="通知メールの配信停止リンクから呼ばれます。DELETE ではなく POST ですが、購読を削除するので Delete に分類しています。",
)
def unsubscribe_with_token(req: UnsubscribeWithTokenRequest):
    try:
        return sns_service.unsubscribe_with_token(req.subscription_arn, req.token)
    except Exception as e:
        raise to_http(e)
