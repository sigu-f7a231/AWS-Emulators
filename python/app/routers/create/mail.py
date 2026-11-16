"""Mail - Create: メール送信（Mailbox に記録 ＋ SMTP 有効時は実送信）"""
from fastapi import APIRouter

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES

from app.schemas.mail import SendEmailTaskRequest, SendMailRequest
from app.services.mail_service import send_email

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.post("/api/emails/send", summary="[Mail] テストメールを送信")
def send_test_email(req: SendEmailTaskRequest):
    try:
        record = send_email(
            to_address=req.to_email,
            subject=req.subject,
            body=req.body,
            source="direct",
            source_detail="Manual test send",
            delivery_mode=req.delivery_mode,
        )
    except Exception as e:
        raise to_http(e)
    return {"status": "sent", "email": record}


@router.post(
    "/api/mail/send",
    summary="[Mail] メールを送信（フラット版）",
    description="レスポンスの `email.status` が `delivered_smtp (...)` なら SMTP 送信成功、`smtp_error: ...` なら失敗、`delivered_locally` なら擬似送信（Mailbox への記録のみ）です。`delivery_mode: smtp` で SMTP 未設定なら 400。",
)
def send_mail_flat(req: SendMailRequest):
    try:
        record = send_email(
            to_address=req.to,
            subject=req.subject,
            body=req.body,
            source="direct",
            source_detail="Manual send",
            delivery_mode=req.delivery_mode,
        )
    except Exception as e:
        raise to_http(e)
    return {"status": "sent", "email": record}
