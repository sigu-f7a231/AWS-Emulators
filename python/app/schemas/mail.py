from typing import Literal, Optional

from pydantic import BaseModel, Field


class SendEmailTaskRequest(BaseModel):
    to_email: str = Field(..., description="送信先メールアドレス", examples=["user@example.com"])
    subject: str = Field(..., description="件名", examples=["テストメール"])
    body: str = Field(..., description="本文", examples=["ローカル環境からのテストメールです。"])
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="送信方法。local = 擬似送信 / smtp = SMTP で送信（未設定なら 400）/ 省略 = SMTP が有効なら SMTP"
    )


class SendMailRequest(BaseModel):
    to: str = Field(..., description="送信先メールアドレス", examples=["user@example.com"])
    subject: str = Field("", description="件名", examples=["テストメール"])
    body: str = Field("", description="本文", examples=["ローカル環境からのテストメールです。"])
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="送信方法。local = 擬似送信 / smtp = SMTP で送信（未設定なら 400）/ 省略 = SMTP が有効なら SMTP"
    )
