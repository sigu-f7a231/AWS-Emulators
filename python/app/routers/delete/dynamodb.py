"""DynamoDB - Delete: テーブル削除 / アイテム削除"""
from fastapi import APIRouter, Path

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.dynamodb import DeleteItemFlatRequest, DeleteItemRequest
from app.services.dynamo_service import delete_table, delete_table_item

router = APIRouter(responses=VALIDATION_RESPONSES)

TABLE = Path(..., description="テーブル名")


@router.delete("/api/dynamodb/tables/{table_name}", summary="[DynamoDB] テーブルを削除（DeleteTable）")
def delete_table_endpoint(table_name: str = TABLE):
    try:
        return delete_table(table_name)
    except Exception as e:
        raise to_http(e)


@router.delete("/api/dynamodb/item", summary="[DynamoDB] アイテムを削除（フラット版・DeleteItem）", description="DELETE ですがキー（DynamoDB JSON）をボディで渡します。")
def delete_item_flat(req: DeleteItemFlatRequest):
    try:
        return delete_table_item(req.table_name, req.key_attributes)
    except Exception as e:
        raise to_http(e)


@router.post("/api/dynamodb/tables/{table_name}/delete-item", summary="[DynamoDB] アイテムを削除（DeleteItem）")
def delete_table_item_endpoint(req: DeleteItemRequest, table_name: str = TABLE):
    try:
        return delete_table_item(table_name, req.key)
    except Exception as e:
        raise to_http(e)
