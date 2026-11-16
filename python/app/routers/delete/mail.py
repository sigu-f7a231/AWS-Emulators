"""Mail - Delete: 送信済みメールを全削除"""
from fastapi import APIRouter

from app.services.mail_service import clear_sent_emails

router = APIRouter()


@router.delete("/api/emails", summary="[Mail] 送信済みメールを全削除", description="Mailbox の記録だけを消します。送信済みの実メールには影響しません。")
def clear_emails():
    clear_sent_emails()
    return {"message": "All sent emails cleared"}
