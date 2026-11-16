"""DynamoDB 設計 - Delete: テーブル削除 / DB 削除"""
from fastapi import APIRouter, Path, Query

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.services import schema_service

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.delete(
    "/api/dynamodb/databases/{db_name}/tables/{table_name}",
    summary="[DynamoDB 設計] テーブルを削除",
    description="他のテーブルから外部キーで参照されている場合は 400 になります。",
)
def delete_schema_table(db_name: str = Path(..., description="DB 名"), table_name: str = Path(..., description="テーブル名（DB 名なし）")):
    try:
        return schema_service.delete_table(db_name, table_name)
    except Exception as e:
        raise to_http(e)


@router.delete(
    "/api/dynamodb/databases/{db_name}",
    summary="[DynamoDB 設計] DB を削除",
    description="テーブルが残っている場合は 400。`cascade=true` なら DB 内の実テーブルもすべて削除します。",
)
def delete_database(
    db_name: str = Path(..., description="DB 名"),
    cascade: bool = Query(False, description="true なら DB 内のテーブルもすべて削除"),
):
    try:
        return schema_service.delete_database(db_name, cascade)
    except Exception as e:
        raise to_http(e)
