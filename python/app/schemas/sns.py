from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateTopicRequest(BaseModel):
    topic_name: str = Field(..., description="作成するトピック名", examples=["my-topic"])


class SubscribeTopicRequest(BaseModel):
    protocol: str = Field("email", description="プロトコル（email / sqs など）", examples=["email"])
    endpoint: str = Field(..., description="メールアドレスまたは SQS キュー ARN", examples=["user@example.com"])


class PublishTopicRequest(BaseModel):
    subject: str = Field("Notification from AWS SNS", description="件名")
    message: str = Field(..., description="メッセージ本文", examples=["システムメンテナンスのお知らせ"])
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="送信方法。local = 擬似送信 / smtp = SMTP で送信（未設定なら 400、SNS への発行もしない）/ 省略 = SMTP が有効なら SMTP"
    )


class SubscribeFlatRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    protocol: str = Field("email", description="プロトコル（email / sqs など）")
    endpoint: str = Field(..., description="メールアドレスまたは SQS キュー ARN", examples=["user@example.com"])


class SubscribeSqsFlatRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    queue_url: str = Field(..., description="紐付ける SQS キュー URL", examples=["https://aws-emulator:9297/000000000000/my-queue"])


class PublishFlatRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    subject: str = Field("通知", description="件名")
    message: str = Field(..., description="メッセージ本文", examples=["システムメンテナンスのお知らせ"])
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="送信方法。local = 擬似送信 / smtp = SMTP で送信（未設定なら 400、SNS への発行もしない）/ 省略 = SMTP が有効なら SMTP"
    )
