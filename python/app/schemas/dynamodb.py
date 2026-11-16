from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QueryItemsRequest(BaseModel):
    key_conditions: Dict[str, Any] = Field(..., description="キー条件（属性名 → 値）", examples=[{"id": "user-1"}])
    index_name: Optional[str] = Field(None, description="使用するインデックス名（省略時はテーブル本体）")


class ItemAttribute(BaseModel):
    name: str = Field(..., description="属性名", examples=["id"])
    type: str = Field("S", description="型（S / N / BOOL / M / L など）")
    value: Any = Field(..., description="値", examples=["user-1"])


class PutItemRequest(BaseModel):
    attributes: List[ItemAttribute] = Field(..., description="アイテムの属性一覧")


class DeleteItemRequest(BaseModel):
    key: Dict[str, Dict[str, Any]] = Field(..., description="削除するアイテムのキー（DynamoDB 形式）", examples=[{"id": {"S": "user-1"}}])


class PutItemFlatRequest(BaseModel):
    table_name: str = Field(..., description="テーブル名", examples=["users"])
    attributes: List[ItemAttribute] = Field(..., description="アイテムの属性一覧")


class DeleteItemFlatRequest(BaseModel):
    table_name: str = Field(..., description="テーブル名", examples=["users"])
    key_attributes: Dict[str, Dict[str, Any]] = Field(..., description="削除するアイテムのキー（DynamoDB 形式）", examples=[{"id": {"S": "user-1"}}])
