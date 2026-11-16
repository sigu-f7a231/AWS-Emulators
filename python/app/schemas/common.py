from typing import Any, Dict
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="エラー内容", examples=["An error occurred (NoSuchBucket) ..."])


class MessageResponse(BaseModel):
    message: str = Field(..., description="処理結果メッセージ")


# 全エンドポイント共通のエラーレスポンス定義（Swagger に表示）
ERROR_RESPONSES: Dict[int | str, Dict[str, Any]] = {
    500: {"model": ErrorResponse, "description": "AWS Emulator / 内部処理でエラーが発生"},
}

# 入力チェックがあるエンドポイント用
VALIDATION_RESPONSES: Dict[int | str, Dict[str, Any]] = {
    400: {"model": ErrorResponse, "description": "入力エラー。DynamoDB では AWS のエラーコードをそのまま返す（例: `ValidationException: ...` / `ResourceNotFoundException: ...` / `ConditionalCheckFailedException: ...`）"},
}
