"""DynamoDB - Create: テーブル作成（CreateTable）"""
from fastapi import APIRouter

from app.routers._errors import to_http
from app.schemas.common import VALIDATION_RESPONSES
from app.schemas.dynamodb import FullCreateTableRequest
from app.services.dynamo_service import create_table_full

router = APIRouter(responses=VALIDATION_RESPONSES)


@router.post(
    "/api/dynamodb/tables",
    summary="[DynamoDB] テーブルを作成",
    description=(
        "AWS の CreateTable と同じです。パーティションキー（必須）・ソートキー（任意）・GSI・LSI・課金モードを指定します。\n\n"
        "- キーの型は S / N / B。キー以外の属性は定義不要（アイテムはスキーマレス）\n"
        "- LSI はテーブルにソートキーが必要で、作成時にしか追加できません\n"
        "- テーブル名やキー・インデックスの制約違反は、DynamoDB の `ValidationException` がそのまま返ります"
    ),
)
def create_table_endpoint(req: FullCreateTableRequest):
    try:
        desc = create_table_full(
            table_name=req.table_name,
            partition_key_name=req.partition_key_name,
            partition_key_type=req.partition_key_type,
            sort_key_name=req.sort_key_name or None,
            sort_key_type=req.sort_key_type,
            billing_mode=req.billing_mode,
            read_capacity_units=req.read_capacity_units,
            write_capacity_units=req.write_capacity_units,
            gsis=[g.model_dump() for g in req.gsis] if req.gsis else None,
            lsis=[l.model_dump() for l in req.lsis] if req.lsis else None,
        )
        return {"message": f"Table '{req.table_name}' created", "detail": desc}
    except Exception as e:
        raise to_http(e)
