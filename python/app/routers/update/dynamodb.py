"""DynamoDB - Update: アイテムの追加・置き換え（PutItem）"""
from fastapi import APIRouter, Path

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.dynamodb import PutItemFlatRequest, PutItemRequest
from app.services.dynamo_service import put_item, put_or_update_item

router = APIRouter(responses=VALIDATION_RESPONSES)

PUT_NOTE = (
    "AWS の PutItem と同じで、同じキーのアイテムがあれば丸ごと置き換えます。キー以外の属性は自由です（スキーマレス）。\n\n"
    "`item` に DynamoDB JSON（B / BS は base64）を渡すか、`attributes` に画面の行形式を渡します。"
    "キーの欠落や型違いなどは DynamoDB の `ValidationException` がそのまま返ります。"
)


def _put(table_name: str, req):
    if req.item is not None:
        return put_item(table_name, req.item)
    return put_or_update_item(table_name, [a.model_dump() for a in req.attributes])


@router.put("/api/dynamodb/item", summary="[DynamoDB] アイテムを保存（フラット版・PutItem）", description=PUT_NOTE)
def put_item_flat(req: PutItemFlatRequest):
    try:
        return _put(req.table_name, req)
    except Exception as e:
        raise to_http(e)


@router.post("/api/dynamodb/tables/{table_name}/items", summary="[DynamoDB] アイテムを保存（PutItem）", description=PUT_NOTE)
def put_table_item_endpoint(req: PutItemRequest, table_name: str = Path(..., description="テーブル名")):
    try:
        return _put(table_name, req)
    except Exception as e:
        raise to_http(e)
