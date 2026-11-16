from typing import Literal, Optional

from pydantic import BaseModel, Field


class SubscribeEmailRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    email: str = Field(..., description="登録するメールアドレス", examples=["user@example.com"])


class SubscribeSqsRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    queue_name: str = Field(..., description="紐付ける SQS キュー名", examples=["my-queue"])


class PipelineBroadcastRequest(BaseModel):
    topic_arn: str = Field(..., description="配信元トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    subject: str = Field("重要なお知らせ", description="件名")
    message: str = Field(..., description="メッセージ本文", examples=["SNSパイプライン経由のブロードキャストメッセージです。"])
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="送信方法。local = 擬似送信 / smtp = SMTP で送信（未設定なら 400、SNS への発行もしない）/ 省略 = SMTP が有効なら SMTP"
    )
