"""DynamoDB の DB / テーブル設計（論理スキーマ）用モデル"""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class CreateDatabaseRequest(BaseModel):
    name: str = Field(..., description="DB 名（英数字・_・-。実テーブル名の接頭辞になる）", examples=["shop"])
    description: str = Field("", description="説明", examples=["EC サイトのデータ"])


class ColumnDef(BaseModel):
    name: str = Field(..., description="カラム名", examples=["user_id"])
    type: Literal["S", "N", "B", "BOOL", "L", "M"] = Field("S", description="型（主キー・インデックスに使うカラムは S / N / B）")
    required: bool = Field(False, description="必須か（主キーは自動で必須）")
    description: str = Field("", description="説明")


class IndexDef(BaseModel):
    name: str = Field(..., description="インデックス名（3 文字以上）", examples=["user_id-index"])
    type: Literal["GSI", "LSI"] = Field("GSI", description="GSI（任意のキー）/ LSI（テーブルと同じ PK ＋ 別の SK。テーブルに SK が必要）")
    partition_key: Optional[str] = Field(None, description="GSI のパーティションキー（LSI では無視）", examples=["user_id"])
    sort_key: Optional[str] = Field(None, description="ソートキー（GSI は任意、LSI は必須）", examples=["created_at"])
    projection_type: Literal["ALL", "KEYS_ONLY"] = Field("ALL", description="射影")


class ForeignKeyDef(BaseModel):
    name: Optional[str] = Field(None, description="外部キー名（省略時は自動）")
    columns: List[str] = Field(..., description="このテーブルのカラム。参照先の主キーと同じ数（PK のみなら 1 つ、PK+SK なら 2 つ）", examples=[["user_id"]])
    ref_table: str = Field(..., description="参照先テーブル名（同じ DB 内。DB 名は付けない）", examples=["users"])


class CreateSchemaTableRequest(BaseModel):
    name: str = Field(..., description="テーブル名（DB 内での名前。実テーブル名は `DB名.テーブル名`）", examples=["orders"])
    description: str = Field("", description="説明")
    columns: List[ColumnDef] = Field(..., description="カラム定義")
    partition_key: str = Field(..., description="パーティションキーにするカラム名", examples=["order_id"])
    sort_key: Optional[str] = Field(None, description="ソートキーにするカラム名（任意）")
    indexes: List[IndexDef] = Field(default_factory=list, description="セカンダリインデックス")
    foreign_keys: List[ForeignKeyDef] = Field(default_factory=list, description="他テーブル（または自分自身）の主キーへの参照")
    billing_mode: Literal["PAY_PER_REQUEST", "PROVISIONED"] = Field("PAY_PER_REQUEST", description="課金モード")
    read_capacity_units: int = Field(5, ge=1, description="PROVISIONED 時の RCU")
    write_capacity_units: int = Field(5, ge=1, description="PROVISIONED 時の WCU")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "name": "orders",
                "description": "注文",
                "columns": [
                    {"name": "order_id", "type": "S"},
                    {"name": "user_id", "type": "S", "required": True},
                    {"name": "created_at", "type": "S"},
                    {"name": "total", "type": "N"},
                ],
                "partition_key": "order_id",
                "indexes": [{"name": "user_id-index", "type": "GSI", "partition_key": "user_id", "sort_key": "created_at"}],
                "foreign_keys": [{"columns": ["user_id"], "ref_table": "users"}],
            }]
        }
    }


class UpdateSchemaTableRequest(BaseModel):
    description: Optional[str] = Field(None, description="説明（省略時は変更しない）")
    columns: Optional[List[ColumnDef]] = Field(None, description="カラム定義（省略時は変更しない）。主キー・インデックスのカラムは削除・型変更不可")
    foreign_keys: Optional[List[ForeignKeyDef]] = Field(None, description="外部キー（省略時は変更しない。空配列で全削除）")
