"""DynamoDB 設計 - Update: テーブル定義の更新（説明・カラム・外部キー）"""
from fastapi import APIRouter, Path

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.dynamodb_schema import UpdateSchemaTableRequest
from app.services import schema_service

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.put(
    "/api/dynamodb/databases/{db_name}/tables/{table_name}",
    summary="[DynamoDB 設計] テーブル定義を更新",
    description="説明・カラム・外部キーを更新します。主キーとインデックスは DynamoDB の制約で変更できません（変更したい場合はテーブルを作り直してください）。",
)
def update_schema_table(
    req: UpdateSchemaTableRequest,
    db_name: str = Path(..., description="DB 名"),
    table_name: str = Path(..., description="テーブル名（DB 名なし）"),
):
    try:
        spec = req.model_dump()
        if req.columns is None:
            spec.pop("columns")
        t = schema_service.update_table(db_name, table_name, spec)
        return {"message": f"テーブル「{t['physical_name']}」の定義を更新しました", "table": t}
    except Exception as e:
        raise to_http(e)
