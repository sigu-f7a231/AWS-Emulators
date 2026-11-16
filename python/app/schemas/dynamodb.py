"""DynamoDB（AWS と同じ仕様）のリクエストモデル"""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

KeyType = Literal["S", "N", "B"]
AttrType = Literal["S", "N", "B", "BOOL", "NULL", "M", "L", "SS", "NS", "BS"]
Projection = Literal["ALL", "KEYS_ONLY", "INCLUDE"]


class GsiDefinition(BaseModel):
    name: str = Field(..., description="インデックス名", examples=["email-index"])
    partition_key: str = Field(..., description="パーティションキー名", examples=["email"])
    partition_key_type: KeyType = Field("S", description="型（S / N / B）")
    sort_key: Optional[str] = Field(None, description="ソートキー名（任意）")
    sort_key_type: Optional[KeyType] = Field("S", description="型（S / N / B）")
    projection_type: Projection = Field("ALL", description="射影（INCLUDE のときは non_key_attributes も指定）")
    non_key_attributes: List[str] = Field(default_factory=list, description="INCLUDE で射影する非キー属性")


class LsiDefinition(BaseModel):
    name: str = Field(..., description="インデックス名", examples=["created-index"])
    sort_key: str = Field(..., description="ソートキー名（パーティションキーはテーブルと同じ）", examples=["created_at"])
    sort_key_type: KeyType = Field("S", description="型（S / N / B）")
    projection_type: Projection = Field("ALL", description="射影")
    non_key_attributes: List[str] = Field(default_factory=list, description="INCLUDE で射影する非キー属性")


class FullCreateTableRequest(BaseModel):
    table_name: str = Field(..., description="テーブル名（3〜255 文字、英数字・_・-・.）", examples=["Users"])
    partition_key_name: str = Field(..., description="パーティションキー名", examples=["id"])
    partition_key_type: KeyType = Field("S", description="型（S / N / B）")
    sort_key_name: Optional[str] = Field(None, description="ソートキー名（任意）")
    sort_key_type: Optional[KeyType] = Field("S", description="型（S / N / B）")
    billing_mode: Literal["PAY_PER_REQUEST", "PROVISIONED"] = Field("PAY_PER_REQUEST", description="課金モード")
    read_capacity_units: int = Field(5, ge=1, description="PROVISIONED 時の RCU")
    write_capacity_units: int = Field(5, ge=1, description="PROVISIONED 時の WCU")
    gsis: Optional[List[GsiDefinition]] = Field(None, description="グローバルセカンダリインデックス")
    lsis: Optional[List[LsiDefinition]] = Field(None, description="ローカルセカンダリインデックス（テーブルにソートキーが必要・作成時のみ指定可）")


class QueryItemsRequest(BaseModel):
    key_conditions: Dict[str, Any] = Field(
        ..., description="キー条件（属性名 → 値）。値の型はキー定義から決まる。DynamoDB JSON（{\"N\": \"1\"}）でも可",
        examples=[{"id": "user-1"}],
    )
    index_name: Optional[str] = Field(None, description="使用するインデックス名（省略時はテーブル本体）")


class ItemAttribute(BaseModel):
    name: str = Field(..., description="属性名", examples=["id"])
    type: AttrType = Field("S", description="型（S / N / B / BOOL / NULL / M / L / SS / NS / BS）")
    value: Any = Field("", description="値。B は base64、M / L は JSON、SS / NS / BS は JSON 配列かカンマ区切り", examples=["user-1"])


DDB_ITEM_EXAMPLE = {
    "id": {"S": "user-1"},
    "age": {"N": "30"},
    "active": {"BOOL": True},
    "tags": {"SS": ["a", "b"]},
    "profile": {"M": {"city": {"S": "Tokyo"}}},
}


class _ItemBody(BaseModel):
    item: Optional[Dict[str, Dict[str, Any]]] = Field(
        None, description="アイテム（DynamoDB JSON）。attributes と どちらか一方を指定", examples=[DDB_ITEM_EXAMPLE],
    )
    attributes: Optional[List[ItemAttribute]] = Field(None, description="アイテム（画面の行形式）。item と どちらか一方を指定")

    @model_validator(mode="after")
    def _one_of(self):
        if (self.item is None) == (self.attributes is None):
            raise ValueError("item（DynamoDB JSON）と attributes のどちらか一方を指定してください")
        return self


class PutItemRequest(_ItemBody):
    pass


class PutItemFlatRequest(_ItemBody):
    table_name: str = Field(..., description="テーブル名", examples=["Users"])


class DeleteItemRequest(BaseModel):
    key: Dict[str, Dict[str, Any]] = Field(..., description="削除するアイテムのキー（DynamoDB JSON）", examples=[{"id": {"S": "user-1"}}])


class DeleteItemFlatRequest(BaseModel):
    table_name: str = Field(..., description="テーブル名", examples=["Users"])
    key_attributes: Dict[str, Dict[str, Any]] = Field(..., description="削除するアイテムのキー（DynamoDB JSON）", examples=[{"id": {"S": "user-1"}}])
