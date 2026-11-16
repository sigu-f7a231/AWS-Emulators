"""SNS - Read: トピック一覧 / サブスクリプション一覧"""
from fastapi import APIRouter, HTTPException, Path

from app.aws_client import get_client

router = APIRouter()


@router.get("/api/sns/topics", summary="[SNS] トピック一覧")
def list_topics():
    try:
        sns = get_client("sns")
        res = sns.list_topics()
        return {"topics": [{"arn": t["TopicArn"], "name": t["TopicArn"].split(":")[-1]} for t in res.get("Topics", [])]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/sns/topics/{topic_arn:path}/subscriptions", summary="[SNS] トピックのサブスクリプション一覧")
def list_subscriptions(topic_arn: str = Path(..., description="トピック ARN")):
    try:
        sns = get_client("sns")
        res = sns.list_subscriptions_by_topic(TopicArn=topic_arn)
        subs = [
            {"arn": s.get("SubscriptionArn"), "protocol": s.get("Protocol"), "endpoint": s.get("Endpoint")}
            for s in res.get("Subscriptions", [])
        ]
        return {"topic_arn": topic_arn, "subscriptions": subs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
