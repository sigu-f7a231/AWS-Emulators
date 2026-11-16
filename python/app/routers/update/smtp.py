"""SMTP - Update: 設定の保存"""
from fastapi import APIRouter

from app.schemas.smtp import SmtpConfigRequest, SmtpSaveResponse
from app.services.mail_service import update_smtp_config

router = APIRouter()


@router.post(
    "/api/smtp/config",
    response_model=SmtpSaveResponse,
    summary="[SMTP] 設定を保存",
    description="`smtp_password` を空にすると保存済みのパスワードを維持します。`clear_password: true` で削除します。",
)
def update_smtp_configuration(req: SmtpConfigRequest):
    cfg = update_smtp_config(req.model_dump())
    return {"message": "SMTP設定を保存しました", "config": cfg}
