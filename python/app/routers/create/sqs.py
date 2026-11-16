"""SQS - Create: キュー作成 / メッセージ送信 / メールタスク投入・処理"""
import json

from fastapi import APIRouter, HTTPException, Path

from app.aws_client import get_client
from app.schemas.mail import SendEmailTaskRequest
from app.schemas.sqs import CreateQueueRequest, SendMessageRequest, SendMessageFlatRequest
from app.services.mail_service import send_email

router = APIRouter()

QUEUE_NAME = Path(..., description="キュー名")


@router.post("/api/sqs/queues", summary="[SQS] キューを作成")
def create_queue(req: CreateQueueRequest):
    try:
        sqs = get_client("sqs")
        res = sqs.create_queue(QueueName=req.queue_name)
        return {"queue_url": res.get("QueueUrl"), "message": f"Queue '{req.queue_name}' created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/sqs/queues/{queue_name}/send", summary="[SQS] メッセージを送信")
def send_queue_message(req: SendMessageRequest, queue_name: str = QUEUE_NAME):
    try:
        sqs = get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        send_res = sqs.send_message(QueueUrl=q_url, MessageBody=req.message_body)
        return {"message_id": send_res.get("MessageId"), "status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/sqs/send", summary="[SQS] メッセージを送信（フラット版）")
def send_message_flat(req: SendMessageFlatRequest):
    try:
        sqs = get_client("sqs")
        res = sqs.send_message(QueueUrl=req.queue_url, MessageBody=req.message_body)
        return {"message_id": res.get("MessageId"), "status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/api/sqs/queues/{queue_name}/send-email-task",
    summary="[SQS] メール送信タスクをキューに投入",
    description='`{"type": "email_task", "to", "subject", "body"}` 形式のメッセージをキューに送ります。',
)
def send_sqs_email_task(req: SendEmailTaskRequest, queue_name: str = QUEUE_NAME):
    try:
        sqs = get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        payload = json.dumps({
            "type": "email_task",
            "to": req.to_email,
            "subject": req.subject,
            "body": req.body,
        })
        res = sqs.send_message(QueueUrl=q_url, MessageBody=payload)
        return {"message_id": res.get("MessageId"), "status": "enqueued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/api/sqs/queues/{queue_name}/process-messages",
    summary="[SQS] メールタスクを処理してメールを送信",
    description="キューから最大 10 件受信し、メールタスクならメールを送信（作成）します。処理したメッセージはキューから削除されます。",
)
def process_sqs_email_tasks(queue_name: str = QUEUE_NAME):
    try:
        sqs = get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        res = sqs.receive_message(QueueUrl=q_url, MaxNumberOfMessages=10, WaitTimeSeconds=1)
        processed = []
        for m in res.get("Messages", []):
            try:
                data = json.loads(m["Body"])
                if data.get("type") == "email_task":
                    sent = send_email(
                        to_address=data["to"],
                        subject=data["subject"],
                        body=data["body"],
                        source="sqs",
                        source_detail=f"Queue: {queue_name}",
                    )
                    processed.append(sent)
                sqs.delete_message(QueueUrl=q_url, ReceiptHandle=m["ReceiptHandle"])
            except Exception:
                pass
        return {"processed_count": len(processed), "emails": processed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
