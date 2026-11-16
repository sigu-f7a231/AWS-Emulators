"""Mail - Read: 送信済みメール一覧（Mailbox）"""
from fastapi import APIRouter

from app.services.mail_service import list_sent_emails

router = APIRouter()


@router.get("/api/emails", summary="[Mail] 送信済みメール一覧")
def get_emails():
    return {"emails": list_sent_emails()}


@router.get("/api/mail/list", summary="[Mail] 送信済みメール一覧（フラット版）")
def list_mail():
    return {"emails": list_sent_emails()}
