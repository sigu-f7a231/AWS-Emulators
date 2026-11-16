"""DynamoDB 設計 - Read: DB 一覧 / DB 詳細（テーブル定義・リレーション）/ テーブル定義"""
from fastapi import APIRouter, Path, Query

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.services import schema_service

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.get("/api/dynamodb/databases", summary="[DynamoDB 設計] DB 一覧")
def list_databases():
    try:
        return schema_service.list_databases()
    except Exception as e:
        raise to_http(e)


@router.get(
    "/api/dynamodb/databases/{db_name}",
    summary="[DynamoDB 設計] DB の詳細（テーブル定義とリレーション）",
    description="各テーブルの `exists` が false なら、定義はあるが実テーブルがありません（エミュレータのデータを消した場合など）。",
)
def get_database(db_name: str = Path(..., description="DB 名")):
    try:
        return schema_service.get_database(db_name)
    except Exception as e:
        raise to_http(e)


@router.get("/api/dynamodb/databases/{db_name}/tables/{table_name}", summary="[DynamoDB 設計] テーブル定義")
def get_schema_table(db_name: str = Path(..., description="DB 名"), table_name: str = Path(..., description="テーブル名（DB 名なし）")):
    try:
        return schema_service.get_table(db_name, table_name)
    except Exception as e:
        raise to_http(e)


@router.get(
    "/api/dynamodb/table-schema",
    summary="[DynamoDB 設計] 実テーブル名からテーブル定義を取得",
    description="`shop.users` のような実テーブル名で引きます。設計管理外のテーブルは 404。",
)
def get_schema_by_physical(table: str = Query(..., description="実テーブル名（例: shop.users）")):
    try:
        return schema_service.get_table_by_physical(table)
    except Exception as e:
        raise to_http(e)
