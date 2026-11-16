"""DynamoDB - Update: アイテムの追加・上書き（PutItem による upsert）"""
from fastapi import APIRouter, Path

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES

from app.schemas.dynamodb import PutItemFlatRequest, PutItemRequest
from app.services.dynamo_service import put_or_update_item

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.put("/api/dynamodb/item", summary="[DynamoDB] アイテムを追加・更新（フラット版）", description="同じキーのアイテムがあれば上書きします。DB/テーブル設計で作ったテーブルなら、型・必須・外部キーをチェックします（違反は 400）。")
def put_item_flat(req: PutItemFlatRequest):
    try:
        return put_or_update_item(req.table_name, [a.model_dump() for a in req.attributes])
    except Exception as e:
        raise to_http(e)


@router.post("/api/dynamodb/tables/{table_name}/items", summary="[DynamoDB] アイテムを追加・更新", description="同じキーのアイテムがあれば上書きします。DB/テーブル設計で作ったテーブルなら、型・必須・外部キーをチェックします（違反は 400）。")
def put_table_item_endpoint(req: PutItemRequest, table_name: str = Path(..., description="テーブル名")):
    try:
        return put_or_update_item(table_name, [a.model_dump() for a in req.attributes])
    except Exception as e:
        raise to_http(e)
