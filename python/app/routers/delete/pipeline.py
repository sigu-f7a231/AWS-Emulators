"""Pipeline - Delete: サブスクリプション解除"""
from fastapi import APIRouter, Path

from app.routers._errors import to_http
from app.services.pipeline import unsubscribe_arn

router = APIRouter()


@router.delete("/api/pipeline/subscriptions/{subscription_arn:path}", summary="[Pipeline] サブスクリプションを解除")
def remove_subscription_api(subscription_arn: str = Path(..., description="サブスクリプション ARN")):
    try:
        return unsubscribe_arn(subscription_arn)
    except Exception as e:
        raise to_http(e)
