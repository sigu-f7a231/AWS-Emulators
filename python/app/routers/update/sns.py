"""SNS - Update: 購読の承認（ConfirmSubscription）"""
from fastapi import APIRouter

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.sns import ConfirmSubscriptionRequest
from app.services import sns_service

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.post(
    "/api/sns/confirm-subscription",
    summary="[SNS] 購読を承認（ConfirmSubscription）",
    description="確認メールのリンクのトークンで、承認待ちの email 購読を承認済みにします。リンクの有効期限は AWS と同じ 3 日です。",
)
def confirm_subscription(req: ConfirmSubscriptionRequest):
    try:
        return sns_service.confirm_subscription(req.token, req.topic_arn)
    except Exception as e:
        raise to_http(e)
