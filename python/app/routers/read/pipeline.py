"""Pipeline - Read: SNS → Email / SQS のパイプライン構成"""
from fastapi import APIRouter

from app.routers._errors import to_http

from app.services.pipeline import get_pipeline_overview

router = APIRouter()


@router.get("/api/pipeline/overview", summary="[Pipeline] トピック・キュー・購読の全体像")
def get_pipeline_overview_api():
    try:
        return get_pipeline_overview()
    except Exception as e:
        raise to_http(e)


@router.get("/api/pipeline/list", summary="[Pipeline] パイプライン一覧（フラット版）")
def list_pipelines():
    try:
        overview = get_pipeline_overview()
        pipelines = []
        for p in overview.get("pipelines", []):
            subs = []
            for s in p.get("email_subscriptions", []):
                subs.append({"type": "email", "endpoint": s.get("email", ""), "arn": s.get("subscription_arn"), "status": s.get("status")})
            for s in p.get("sqs_subscriptions", []):
                subs.append({"type": "sqs", "endpoint": s.get("queue_name", ""), "arn": s.get("subscription_arn"), "status": s.get("status")})
            pipelines.append({
                "id": p.get("topic_arn", ""),
                "topic_arn": p.get("topic_arn", ""),
                "topic_name": p.get("topic_name", ""),
                "subscriptions": subs,
            })
        return pipelines
    except Exception as e:
        raise to_http(e)
