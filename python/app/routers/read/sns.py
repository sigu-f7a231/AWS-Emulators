"""SNS - Read: トピック一覧 / サブスクリプション一覧（承認状態つき）"""
from fastapi import APIRouter, Path

from app.routers._errors import to_http
from app.services import sns_service

router = APIRouter()


@router.get("/api/sns/topics", summary="[SNS] トピック一覧", description="NextToken をたどって全件返します。各トピックにタイプ（standard / fifo）と表示名を付けます。")
def list_topics():
    try:
        return {"topics": sns_service.list_topics(with_attributes=True)}
    except Exception as e:
        raise to_http(e)


@router.get(
    "/api/sns/topics/{topic_arn:path}/subscriptions",
    summary="[SNS] トピックのサブスクリプション一覧",
    description="`status` は email / email-json なら `pending_confirmation`（承認待ち）か `confirmed`（承認済み）、その他のプロトコルは常に `confirmed`。",
)
def list_subscriptions(topic_arn: str = Path(..., description="トピック ARN")):
    try:
        return {"topic_arn": topic_arn, "subscriptions": sns_service.list_subscriptions_by_topic(topic_arn)}
    except Exception as e:
        raise to_http(e)
