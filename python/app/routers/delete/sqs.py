"""SQS - Delete: キュー削除"""
from fastapi import APIRouter, HTTPException, Path

from app.aws_client import get_client

router = APIRouter()


@router.delete("/api/sqs/queues/{queue_name}", summary="[SQS] キューを削除")
def delete_queue(queue_name: str = Path(..., description="キュー名")):
    try:
        sqs = get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        sqs.delete_queue(QueueUrl=q_url)
        return {"message": f"Queue '{queue_name}' deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
