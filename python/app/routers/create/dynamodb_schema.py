"""DynamoDB 設計 - Create: DB 作成 / テーブル作成（カラム・主キー・インデックス・外部キー）"""
from fastapi import APIRouter, Path

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.dynamodb_schema import CreateDatabaseRequest, CreateSchemaTableRequest
from app.services import schema_service

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.post(
    "/api/dynamodb/databases",
    summary="[DynamoDB 設計] DB を作成",
    description="論理的な DB を作ります。DB 内のテーブルは実テーブル名 `DB名.テーブル名` で作成されます。",
)
def create_database(req: CreateDatabaseRequest):
    try:
        return {"message": f"DB「{req.name}」を作成しました", "database": schema_service.create_database(req.name, req.description)}
    except Exception as e:
        raise to_http(e)


@router.post(
    "/api/dynamodb/databases/{db_name}/tables",
    summary="[DynamoDB 設計] DB にテーブルを作成",
    description=(
        "カラム定義・主キー（PK / SK）・GSI / LSI・外部キーを指定してテーブルを作成します。\n\n"
        "- 主キー・インデックスに使うカラムの型は S / N / B\n"
        "- 外部キーは同じ DB 内のテーブル（自分自身も可）の主キーを参照します。参照先が PK+SK ならカラムも 2 つ\n"
        "- 作成後、このテーブルへのアイテム保存時に型・必須・外部キーの存在がチェックされます"
    ),
)
def create_schema_table(req: CreateSchemaTableRequest, db_name: str = Path(..., description="DB 名")):
    try:
        t = schema_service.create_table(db_name, req.model_dump())
        return {"message": f"テーブル「{t['physical_name']}」を作成しました", "table": t}
    except Exception as e:
        raise to_http(e)
