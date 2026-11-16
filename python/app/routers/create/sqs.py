"""SQS - Create: キュー作成 / メッセージ送信 / メールタスク投入・処理"""
import json

from fastapi import APIRouter, HTTPException, Path

from app.routers._errors import to_http

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
        task = {
            "type": "email_task",
            "to": req.to_email,
            "subject": req.subject,
            "body": req.body,
        }
        if req.delivery_mode:
            task["delivery_mode"] = req.delivery_mode
        payload = json.dumps(task, ensure_ascii=False)
        res = sqs.send_message(QueueUrl=q_url, MessageBody=payload)
        return {"message_id": res.get("MessageId"), "status": "enqueued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _unwrap_body(body: str):
    """
    メッセージ本文を読む。SNS から届いたメッセージ（{"Type": "Notification", "Message": "..."} の形）なら中身を取り出す。
    戻り値: (中身, SNS 経由か)
    """
    data = json.loads(body)
    if isinstance(data, dict) and data.get("Type") == "Notification" and "Message" in data:
        inner = data["Message"]
        try:
            return json.loads(inner), True
        except (TypeError, ValueError):
            return inner, True
    return data, False


@router.post(
    "/api/sqs/queues/{queue_name}/process-messages",
    summary="[SQS] メールタスクを受信して処理（コンシューマー）",
    description=(
        "AWS のコンシューマーと同じ流れで処理します。\n\n"
        "1. ReceiveMessage で最大 10 件受信（キューの可視性タイムアウトのあいだ、他からは見えなくなる）\n"
        "2. `type: email_task` のメッセージはメールを送信し、**成功したものだけ DeleteMessage** で削除\n"
        "3. メールタスク以外・形式不正・送信失敗のメッセージは **削除しない**。可視性タイムアウト後にキューへ戻り、"
        "再受信できる（キューに DLQ（RedrivePolicy）があれば、maxReceiveCount 回で DLQ へ移る）\n\n"
        "SNS から届いたメッセージ（通知 JSON に包まれた形）も中身を取り出して処理します。"
    ),
)
def process_sqs_email_tasks(queue_name: str = QUEUE_NAME):
    try:
        sqs = get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        res = sqs.receive_message(
            QueueUrl=q_url,
            MaxNumberOfMessages=10,
            WaitTimeSeconds=1,
            AttributeNames=["ApproximateReceiveCount"],
        )
    except Exception as e:
        raise to_http(e)

    processed, skipped, failed = [], [], []
    for m in res.get("Messages", []):
        info = {
            "message_id": m.get("MessageId"),
            "receive_count": int(m.get("Attributes", {}).get("ApproximateReceiveCount", 1)),
        }
        try:
            task, via_sns = _unwrap_body(m["Body"])
        except (TypeError, ValueError):
            skipped.append({**info, "reason": "JSON ではないため処理対象外（キューに残します）"})
            continue
        if not isinstance(task, dict) or task.get("type") != "email_task":
            skipped.append({**info, "reason": "email_task ではないため処理対象外（キューに残します）"})
            continue
        missing = [k for k in ("to", "subject", "body") if not task.get(k) and task.get(k) != ""]
        if missing or not task.get("to"):
            failed.append({**info, "error": f"必須項目がありません: {', '.join(missing or ['to'])}（キューに残します）"})
            continue
        try:
            sent = send_email(
                to_address=task["to"],
                subject=task.get("subject", ""),
                body=task.get("body", ""),
                source="sqs",
                source_detail=f"Queue: {queue_name}" + (" (via SNS)" if via_sns else ""),
                delivery_mode=task.get("delivery_mode"),
            )
        except Exception as e:
            failed.append({**info, "error": f"{e}（キューに残します）"})
            continue
        if str(sent.get("status", "")).startswith("smtp_error"):
            failed.append({**info, "error": f"SMTP 送信失敗: {sent.get('error')}（キューに残し、再試行できるようにします）", "email": sent})
            continue
        # 処理に成功したメッセージだけ削除する
        try:
            sqs.delete_message(QueueUrl=q_url, ReceiptHandle=m["ReceiptHandle"])
        except Exception as e:
            failed.append({**info, "error": f"メールは送信しましたが、メッセージの削除に失敗しました: {e}", "email": sent})
            continue
        processed.append(sent)

    return {
        "processed_count": len(processed),
        "emails": processed,
        "skipped": skipped,
        "failed": failed,
        "note": "削除していないメッセージは、キューの可視性タイムアウト後に再び受信できます",
    }
