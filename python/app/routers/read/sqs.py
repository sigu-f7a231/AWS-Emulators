"""SQS - Read: キュー一覧 / メッセージ受信（のぞき見）"""
from fastapi import APIRouter, HTTPException, Path, Query

from app.aws_client import get_client

router = APIRouter()


@router.get("/api/sqs/queues", summary="[SQS] キュー一覧（メッセージ数つき）")
def list_queues():
    try:
        sqs = get_client("sqs")
        res = sqs.list_queues()
        detailed_queues = []
        for q_url in res.get("QueueUrls", []):
            approx_messages = 0
            try:
                attrs = sqs.get_queue_attributes(
                    QueueUrl=q_url, AttributeNames=["ApproximateNumberOfMessages"]
                ).get("Attributes", {})
                approx_messages = int(attrs.get("ApproximateNumberOfMessages", 0))
            except Exception:
                pass
            detailed_queues.append({"url": q_url, "name": q_url.split("/")[-1], "message_count": approx_messages})
        return {"queues": detailed_queues}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _receive(queue_url: str, max_messages: int, id_key: str):
    sqs = get_client("sqs")
    res = sqs.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=max_messages,
        VisibilityTimeout=5,
        WaitTimeSeconds=1,
    )
    return [
        {id_key: m["MessageId"], "body": m["Body"], "receipt_handle": m["ReceiptHandle"]}
        for m in res.get("Messages", [])
    ]


@router.get(
    "/api/sqs/queues/{queue_name}/messages",
    summary="[SQS] メッセージを受信（削除しない）",
    description="可視性タイムアウト 5 秒で受信します。削除はしないので、5 秒後に再び受信できます。",
)
def receive_queue_messages(
    queue_name: str = Path(..., description="キュー名"),
    max_messages: int = Query(10, ge=1, le=10, description="最大受信件数（1〜10）"),
):
    try:
        sqs = get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        return {"queue": queue_name, "messages": _receive(q_url, max_messages, "id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/sqs/messages", summary="[SQS] メッセージを受信（フラット版・削除しない）")
def get_messages_flat(queue_url: str = Query(..., description="キュー URL")):
    try:
        return {"messages": _receive(queue_url, 10, "message_id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
