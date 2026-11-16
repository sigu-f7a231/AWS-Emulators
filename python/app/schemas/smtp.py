from pydantic import BaseModel, Field


class SmtpConfigRequest(BaseModel):
    smtp_host: str = Field(..., description="SMTP ホスト（空なら実送信しない）", examples=["smtp.gmail.com"])
    smtp_port: int = Field(587, description="ポート（465=SSL / それ以外は STARTTLS を試行）", examples=[587])
    smtp_user: str = Field("", description="認証ユーザー名（不要なら空）")
    smtp_password: str = Field("", description="パスワード。空なら保存済みの値を維持する")
    smtp_from: str = Field("aws-emulator@local.test", description="送信元アドレス（From）")
    is_enabled: bool = Field(True, description="実メール送信を有効にするか")
    clear_password: bool = Field(False, description="true なら保存済みパスワードを削除する")


class SmtpConfigResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str = Field("", description="常に空文字（パスワードは返さない）")
    smtp_from: str
    is_enabled: bool
    has_password: bool = Field(..., description="パスワードが保存済みかどうか")


class SmtpSaveResponse(BaseModel):
    message: str
    config: SmtpConfigResponse


class SmtpTestResponse(BaseModel):
    ok: bool = Field(..., description="接続（＋認証）に成功したか。擬似送信モードでは常に true")
    mode: str = Field(..., description="local = 擬似送信モード（SMTP 未設定・外部に送らない）/ smtp = 実 SMTP", examples=["local"])
    detail: str = Field(..., description="結果の詳細またはエラー内容")
