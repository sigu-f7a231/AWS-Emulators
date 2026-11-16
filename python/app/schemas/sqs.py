from pydantic import BaseModel, Field


class CreateQueueRequest(BaseModel):
    queue_name: str = Field(..., description="作成するキュー名", examples=["my-queue"])


class SendMessageRequest(BaseModel):
    message_body: str = Field(..., description="メッセージ本文", examples=['{"hello": "world"}'])


class SendMessageFlatRequest(BaseModel):
    queue_url: str = Field(..., description="送信先キュー URL", examples=["https://aws-emulator:9297/000000000000/my-queue"])
    message_body: str = Field(..., description="メッセージ本文", examples=['{"hello": "world"}'])
