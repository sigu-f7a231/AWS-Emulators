from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateTopicRequest(BaseModel):
    topic_name: str = Field(..., description="トピック名（1〜256 文字、英数字・-・_）。FIFO で末尾に .fifo が無ければ自動で付ける", examples=["my-topic"])
    topic_type: Literal["standard", "fifo"] = Field("standard", description="タイプ。作成後は変更できない")
    display_name: Optional[str] = Field(None, description="表示名（任意・100 文字まで）。メール購読への送信者名に使われる", examples=["お知らせ"])
    content_based_deduplication: bool = Field(False, description="FIFO のみ: メッセージ本文から重複排除 ID を作る")


class SubscribeTopicRequest(BaseModel):
    protocol: str = Field("email", description="プロトコル（email / sqs など）", examples=["email"])
    endpoint: str = Field(..., description="メールアドレスまたは SQS キュー ARN", examples=["user@example.com"])
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="email 購読の確認メールの送信方法。local = 擬似送信 / smtp = SMTP / 省略 = SMTP が有効なら SMTP"
    )


class PublishTopicRequest(BaseModel):
    subject: str = Field("Notification from AWS SNS", description="件名")
    message: str = Field(..., description="メッセージ本文", examples=["システムメンテナンスのお知らせ"])
    message_group_id: Optional[str] = Field(None, description="FIFO トピックでは必須: メッセージグループ ID")
    message_deduplication_id: Optional[str] = Field(None, description="FIFO トピック: 重複排除 ID（コンテンツベースの重複排除が無効なら必須）")
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="送信方法。local = 擬似送信 / smtp = SMTP で送信（未設定なら 400、SNS への発行もしない）/ 省略 = SMTP が有効なら SMTP"
    )


class SubscribeFlatRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    protocol: str = Field("email", description="プロトコル（email / sqs など）")
    endpoint: str = Field(..., description="メールアドレスまたは SQS キュー ARN", examples=["user@example.com"])
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="email 購読の確認メールの送信方法。local = 擬似送信 / smtp = SMTP / 省略 = SMTP が有効なら SMTP"
    )


class SubscribeSqsFlatRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    queue_url: str = Field(..., description="紐付ける SQS キュー URL", examples=["https://aws-emulator:9297/000000000000/my-queue"])


class PublishFlatRequest(BaseModel):
    topic_arn: str = Field(..., description="トピック ARN", examples=["arn:aws:sns:us-east-1:000000000000:my-topic"])
    subject: str = Field("通知", description="件名")
    message: str = Field(..., description="メッセージ本文", examples=["システムメンテナンスのお知らせ"])
    message_group_id: Optional[str] = Field(None, description="FIFO トピックでは必須: メッセージグループ ID")
    message_deduplication_id: Optional[str] = Field(None, description="FIFO トピック: 重複排除 ID（コンテンツベースの重複排除が無効なら必須）")
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="送信方法。local = 擬似送信 / smtp = SMTP で送信（未設定なら 400、SNS への発行もしない）/ 省略 = SMTP が有効なら SMTP"
    )


class ConfirmSubscriptionRequest(BaseModel):
    token: str = Field(..., description="確認メールのリンクに含まれるトークン")
    topic_arn: Optional[str] = Field(None, description="トピック ARN（指定すればトークンのトピックと一致するか確認する）")


class UnsubscribeWithTokenRequest(BaseModel):
    subscription_arn: str = Field(..., description="サブスクリプション ARN")
    token: str = Field(..., description="通知メールの配信停止リンクに含まれるトークン")


class ResendConfirmationRequest(BaseModel):
    delivery_mode: Optional[Literal["local", "smtp"]] = Field(
        None, description="確認メールの送信方法。local = 擬似送信 / smtp = SMTP（未設定なら 400）/ 省略 = SMTP が有効なら SMTP"
    )
