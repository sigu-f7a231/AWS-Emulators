"""DynamoDB - Delete: テーブル削除 / アイテム削除"""
from fastapi import APIRouter, HTTPException, Path

from app.aws_client import get_client
from app.schemas.dynamodb import DeleteItemFlatRequest, DeleteItemRequest
from app.routers._errors import to_http
from app.services import schema_service
from app.services.dynamo_service import delete_table_item

router = APIRouter()

TABLE = Path(..., description="テーブル名")


@router.delete("/api/dynamodb/tables/{table_name}", summary="[DynamoDB] テーブルを削除", description="DB/テーブル設計で管理しているテーブルが他から外部キーで参照されている場合は 400。")
def delete_table_endpoint(table_name: str = TABLE):
    try:
        # DB/テーブル設計で管理しているテーブルなら、外部キーで参照されていないか確認してから削除し、定義も消す
        schema_service.check_deletable_physical(table_name)
        get_client("dynamodb").delete_table(TableName=table_name)
        schema_service.forget_physical(table_name)
        return {"message": f"Table '{table_name}' deleted"}
    except Exception as e:
        raise to_http(e)


@router.delete("/api/dynamodb/item", summary="[DynamoDB] アイテムを削除（フラット版）", description="DELETE ですがキーをボディ（JSON）で渡します。")
def delete_item_flat(req: DeleteItemFlatRequest):
    try:
        return delete_table_item(req.table_name, req.key_attributes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/dynamodb/tables/{table_name}/delete-item", summary="[DynamoDB] アイテムを削除")
def delete_table_item_endpoint(req: DeleteItemRequest, table_name: str = TABLE):
    try:
        return delete_table_item(table_name, req.key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
