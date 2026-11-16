"""DynamoDB - Read: テーブル一覧 / アイテム一覧（Scan）/ 検索（Query）"""
from fastapi import APIRouter, HTTPException, Path, Query

from app.schemas.dynamodb import QueryItemsRequest
from app.services.dynamo_service import list_tables_with_details, query_table_items, scan_table_items

router = APIRouter()

TABLE = Path(..., description="テーブル名")


@router.get("/api/dynamodb/tables", summary="[DynamoDB] テーブル一覧（詳細つき）", description="配列をそのまま返します。")
def get_all_tables_endpoint():
    try:
        return list_tables_with_details()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/dynamodb/items", summary="[DynamoDB] アイテム一覧（フラット版・Scan）")
def get_items_flat(table: str = Query(..., description="テーブル名")):
    try:
        return scan_table_items(table)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/dynamodb/tables/{table_name}/items", summary="[DynamoDB] アイテム一覧（Scan）")
def get_table_items_endpoint(table_name: str = TABLE):
    try:
        items = scan_table_items(table_name)
        return {"table": table_name, "items": items, "count": len(items)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/api/dynamodb/tables/{table_name}/query",
    summary="[DynamoDB] アイテムを検索（Query）",
    description="条件をボディで渡すため POST ですが、データは変更しないので Read に分類しています。",
)
def query_table_items_endpoint(req: QueryItemsRequest, table_name: str = TABLE):
    try:
        items = query_table_items(table_name, req.key_conditions, req.index_name)
        return {"table": table_name, "items": items, "count": len(items)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
