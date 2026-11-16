"""SNS - Delete: トピック削除"""
from fastapi import APIRouter, HTTPException, Path

from app.aws_client import get_client

router = APIRouter()


@router.delete("/api/sns/topics/{topic_arn:path}", summary="[SNS] トピックを削除")
def delete_topic(topic_arn: str = Path(..., description="トピック ARN")):
    try:
        get_client("sns").delete_topic(TopicArn=topic_arn)
        return {"message": f"Topic '{topic_arn}' deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
