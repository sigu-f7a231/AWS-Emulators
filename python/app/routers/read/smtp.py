"""SMTP - Read: 設定の取得 / 接続テスト（どちらも状態を変えない）"""
from fastapi import APIRouter

from app.schemas.smtp import SmtpConfigResponse, SmtpTestResponse
from app.services.mail_service import public_smtp_config, test_smtp_connection

router = APIRouter()


@router.get(
    "/api/smtp/config",
    response_model=SmtpConfigResponse,
    summary="[SMTP] 設定を取得",
    description="パスワードは返さず、`has_password` で保存済みかどうかだけを返します。",
)
def get_smtp_configuration():
    return public_smtp_config()


@router.post(
    "/api/smtp/test",
    response_model=SmtpTestResponse,
    summary="[SMTP] 接続テスト",
    description="SMTP が未設定・無効なら擬似送信モードとして設定不要で成功（`mode: local`）を返します。有効なら保存済みの設定で接続（＋認証）だけを行います（`mode: smtp`）。メールは送らず、設定も変更しないため Read に分類しています。",
)
def test_smtp_configuration():
    return test_smtp_connection()
