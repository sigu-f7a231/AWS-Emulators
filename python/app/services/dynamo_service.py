"""
DynamoDB 操作（AWS の DynamoDB と同じ仕様で扱う）

- テーブルはパーティションキー / ソートキー / GSI / LSI / 課金モードを指定して作成する
- アイテムはスキーマレス。型は AWS と同じ 10 種類（S N B BOOL NULL M L SS NS BS）
- 入出力は AWS の「DynamoDB JSON」形式（{"name": {"S": "value"}}）。B / BS は base64 文字列で表す
- 入力の検証やエラーは DynamoDB（エミュレータ）に任せ、エラーコードとメッセージをそのまま返す
"""
import base64
import binascii
import json
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from app.aws_client import get_client

ATTRIBUTE_TYPES = ("S", "N", "B", "BOOL", "NULL", "M", "L", "SS", "NS", "BS")
KEY_TYPES = ("S", "N", "B")
SCAN_MAX_ITEMS = 1000


class ItemFormatError(ValueError):
    """入力値を DynamoDB の AttributeValue に変換できない（HTTP 400）"""


# --------------------------------------------------------------------------
# AttributeValue 変換
#   ddb JSON  : API の入出力。B / BS は base64 文字列
#   boto 形式 : boto3 client に渡す形式。B / BS は bytes
# --------------------------------------------------------------------------
def _b64decode(v: Any, where: str) -> bytes:
    if not isinstance(v, str):
        raise ItemFormatError(f"{where}: B 型の値は base64 文字列で指定してください")
    try:
        return base64.b64decode(v, validate=True)
    except (binascii.Error, ValueError):
        raise ItemFormatError(f"{where}: base64 として正しくありません")


def ddb_json_to_boto(av: Any, where: str = "値") -> Dict[str, Any]:
    """DynamoDB JSON の AttributeValue を boto3 用に変換（形式もチェックする）"""
    if not isinstance(av, dict) or len(av) != 1:
        raise ItemFormatError(f"{where}: AttributeValue は {{\"型\": 値}} の形で 1 つだけ指定してください（例: {{\"S\": \"abc\"}}）")
    t, v = next(iter(av.items()))
    if t not in ATTRIBUTE_TYPES:
        raise ItemFormatError(f"{where}: 型「{t}」は使えません（{' / '.join(ATTRIBUTE_TYPES)}）")
    if t == "S":
        if not isinstance(v, str):
            raise ItemFormatError(f"{where}: S 型の値は文字列で指定してください")
        return {"S": v}
    if t == "N":
        if not isinstance(v, str):
            raise ItemFormatError(f"{where}: N 型の値は文字列で指定してください（例: {{\"N\": \"123\"}}）")
        return {"N": v}
    if t == "B":
        return {"B": _b64decode(v, where)}
    if t == "BOOL":
        if not isinstance(v, bool):
            raise ItemFormatError(f"{where}: BOOL 型の値は true / false で指定してください")
        return {"BOOL": v}
    if t == "NULL":
        if v is not True:
            raise ItemFormatError(f"{where}: NULL 型の値は true で指定してください（例: {{\"NULL\": true}}）")
        return {"NULL": True}
    if t == "M":
        if not isinstance(v, dict):
            raise ItemFormatError(f"{where}: M 型の値はオブジェクトで指定してください")
        return {"M": {k: ddb_json_to_boto(x, f"{where}.{k}") for k, x in v.items()}}
    if t == "L":
        if not isinstance(v, list):
            raise ItemFormatError(f"{where}: L 型の値は配列で指定してください")
        return {"L": [ddb_json_to_boto(x, f"{where}[{i}]") for i, x in enumerate(v)]}
    # セット型
    if not isinstance(v, list):
        raise ItemFormatError(f"{where}: {t} 型の値は配列で指定してください")
    if t == "SS":
        if not all(isinstance(x, str) for x in v):
            raise ItemFormatError(f"{where}: SS 型の要素は文字列で指定してください")
        return {"SS": list(v)}
    if t == "NS":
        if not all(isinstance(x, str) for x in v):
            raise ItemFormatError(f"{where}: NS 型の要素は数値の文字列で指定してください（例: [\"1\", \"2\"]）")
        return {"NS": list(v)}
    return {"BS": [_b64decode(x, f"{where}[{i}]") for i, x in enumerate(v)]}


def boto_to_ddb_json(av: Dict[str, Any]) -> Dict[str, Any]:
    """boto3 から返った AttributeValue を DynamoDB JSON に（bytes → base64）"""
    t, v = next(iter(av.items()))
    if t == "B":
        return {"B": base64.b64encode(bytes(v)).decode()}
    if t == "BS":
        return {"BS": [base64.b64encode(bytes(x)).decode() for x in v]}
    if t == "M":
        return {"M": {k: boto_to_ddb_json(x) for k, x in v.items()}}
    if t == "L":
        return {"L": [boto_to_ddb_json(x) for x in v]}
    if t in ("SS", "NS"):
        return {t: list(v)}
    return {t: v}


def ddb_json_to_plain(av: Dict[str, Any]) -> Any:
    """表示用のふつうの JSON 値に（N は精度を保つため文字列のまま、B は base64）"""
    t, v = next(iter(av.items()))
    if t == "M":
        return {k: ddb_json_to_plain(x) for k, x in v.items()}
    if t == "L":
        return [ddb_json_to_plain(x) for x in v]
    if t == "NULL":
        return None
    return v


def plain_to_ddb_json(v: Any, where: str = "値") -> Dict[str, Any]:
    """ふつうの JSON 値を DynamoDB JSON に（M / L の入力欄用。文字列→S、数値→N、真偽→BOOL、null→NULL）"""
    if v is None:
        return {"NULL": True}
    if isinstance(v, bool):
        return {"BOOL": v}
    if isinstance(v, (int, float)):
        return {"N": json.dumps(v)}
    if isinstance(v, str):
        return {"S": v}
    if isinstance(v, list):
        return {"L": [plain_to_ddb_json(x, f"{where}[{i}]") for i, x in enumerate(v)]}
    if isinstance(v, dict):
        return {"M": {k: plain_to_ddb_json(x, f"{where}.{k}") for k, x in v.items()}}
    raise ItemFormatError(f"{where}: この値は変換できません")


def _parse_list(text: str, where: str) -> List[Any]:
    text = text.strip()
    if text.startswith("["):
        try:
            arr = json.loads(text)
        except json.JSONDecodeError as e:
            raise ItemFormatError(f"{where}: JSON 配列として読めません（{e.msg}）")
        if not isinstance(arr, list):
            raise ItemFormatError(f"{where}: 配列で指定してください")
        return arr
    return [x.strip() for x in text.split(",") if x.strip()]


def form_value_to_ddb_json(attr_type: str, raw: Any, where: str) -> Dict[str, Any]:
    """
    画面の入力欄（型 ＋ テキスト）を DynamoDB JSON に変換する。
    S: そのまま / N: 数値の文字列 / B: base64 / BOOL: true・false / NULL: 値なし
    M: JSON オブジェクト / L: JSON 配列（中身は自動で型付け。DynamoDB JSON をそのまま書いてもよい）
    SS・NS・BS: JSON 配列 または カンマ区切り
    """
    t = (attr_type or "S").upper()
    text = "" if raw is None else str(raw)
    if t not in ATTRIBUTE_TYPES:
        raise ItemFormatError(f"{where}: 型「{t}」は使えません（{' / '.join(ATTRIBUTE_TYPES)}）")
    if t == "S":
        return {"S": text}
    if t == "N":
        return {"N": text.strip()}
    if t == "B":
        return {"B": text.strip()}
    if t == "BOOL":
        low = text.strip().lower()
        if low not in ("true", "false"):
            raise ItemFormatError(f"{where}: BOOL 型は true か false を入力してください")
        return {"BOOL": low == "true"}
    if t == "NULL":
        return {"NULL": True}
    if t in ("M", "L"):
        try:
            v = json.loads(text)
        except json.JSONDecodeError as e:
            raise ItemFormatError(f"{where}: {t} 型は JSON で入力してください（{e.msg}）")
        if t == "M":
            if not isinstance(v, dict):
                raise ItemFormatError(f"{where}: M 型は JSON オブジェクト（{{...}}）で入力してください")
            # DynamoDB JSON（{"M": {...}} の中身）として書かれていればそのまま使う
            if v and all(isinstance(x, dict) and len(x) == 1 and next(iter(x)) in ATTRIBUTE_TYPES for x in v.values()):
                return {"M": v}
            return plain_to_ddb_json(v, where)
        if not isinstance(v, list):
            raise ItemFormatError(f"{where}: L 型は JSON 配列（[...]）で入力してください")
        if v and all(isinstance(x, dict) and len(x) == 1 and next(iter(x)) in ATTRIBUTE_TYPES for x in v):
            return {"L": v}
        return plain_to_ddb_json(v, where)
    items = _parse_list(text, where)
    if t == "NS":
        return {"NS": [str(x) if not isinstance(x, str) else x for x in items]}
    if not all(isinstance(x, str) for x in items):
        raise ItemFormatError(f"{where}: {t} 型の要素は文字列で指定してください")
    return {t: items}


def item_to_boto(item: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    if not isinstance(item, dict) or not item:
        raise ItemFormatError("アイテムは 1 つ以上の属性を持つオブジェクトで指定してください")
    return {name: ddb_json_to_boto(av, name) for name, av in item.items()}


def _format_item(item: Dict[str, Any]) -> Dict[str, Any]:
    raw = {k: boto_to_ddb_json(v) for k, v in item.items()}
    return {
        "_raw": raw,
        "attributes": {
            k: {"type": next(iter(v)), "value": ddb_json_to_plain(v), "raw_dynamo": v}
            for k, v in raw.items()
        },
    }


# --------------------------------------------------------------------------
# テーブル
# --------------------------------------------------------------------------
def list_table_names() -> List[str]:
    dynamo = get_client("dynamodb")
    names: List[str] = []
    kwargs: Dict[str, Any] = {}
    while True:
        res = dynamo.list_tables(**kwargs)
        names.extend(res.get("TableNames", []))
        last = res.get("LastEvaluatedTableName")
        if not last:
            return names
        kwargs["ExclusiveStartTableName"] = last


def list_tables_with_details() -> List[Dict]:
    """Lists all tables with their complete key schema, GSI, LSI, attributes, and settings."""
    dynamo = get_client("dynamodb")
    table_names = list_table_names()

    detailed_tables = []
    for t_name in table_names:
        try:
            desc = dynamo.describe_table(TableName=t_name)["Table"]
            key_schema = desc.get("KeySchema", [])
            attr_defs = {a["AttributeName"]: a["AttributeType"] for a in desc.get("AttributeDefinitions", [])}

            keys_info = []
            for k in key_schema:
                k_name = k["AttributeName"]
                keys_info.append({
                    "name": k_name,
                    "type": k["KeyType"], # HASH or RANGE
                    "data_type": attr_defs.get(k_name, "S"),
                })

            # Global Secondary Indexes (GSI)
            gsis = []
            for gsi in desc.get("GlobalSecondaryIndexes", []):
                gsi_keys = []
                for gk in gsi.get("KeySchema", []):
                    gk_name = gk["AttributeName"]
                    gsi_keys.append({
                        "name": gk_name,
                        "type": gk["KeyType"],
                        "data_type": attr_defs.get(gk_name, "S"),
                    })
                gsis.append({
                    "name": gsi.get("IndexName"),
                    "keys": gsi_keys,
                    "projection": gsi.get("Projection", {}).get("ProjectionType", "ALL"),
                    "non_key_attributes": gsi.get("Projection", {}).get("NonKeyAttributes", []),
                    "status": gsi.get("IndexStatus", "ACTIVE"),
                    "item_count": gsi.get("ItemCount", 0),
                })

            # Local Secondary Indexes (LSI)
            lsis = []
            for lsi in desc.get("LocalSecondaryIndexes", []):
                lsi_keys = []
                for lk in lsi.get("KeySchema", []):
                    lk_name = lk["AttributeName"]
                    lsi_keys.append({
                        "name": lk_name,
                        "type": lk["KeyType"],
                        "data_type": attr_defs.get(lk_name, "S"),
                    })
                lsis.append({
                    "name": lsi.get("IndexName"),
                    "keys": lsi_keys,
                    "projection": lsi.get("Projection", {}).get("ProjectionType", "ALL"),
                    "non_key_attributes": lsi.get("Projection", {}).get("NonKeyAttributes", []),
                    "item_count": lsi.get("ItemCount", 0),
                })

            # Billing & Provisioned throughput
            billing_summary = desc.get("BillingModeSummary", {}).get("BillingMode", "PROVISIONED" if "ProvisionedThroughput" in desc else "PAY_PER_REQUEST")
            provisioned = desc.get("ProvisionedThroughput", {})

            detailed_tables.append({
                "name": t_name,
                "status": desc.get("TableStatus", "ACTIVE"),
                "item_count": desc.get("ItemCount", 0),
                "size_bytes": desc.get("TableSizeBytes", 0),
                "keys": keys_info,
                "gsis": gsis,
                "lsis": lsis,
                "billing_mode": billing_summary,
                "rcu": provisioned.get("ReadCapacityUnits", 0),
                "wcu": provisioned.get("WriteCapacityUnits", 0),
                "arn": desc.get("TableArn"),
                "creation_date": str(desc.get("CreationDateTime", "")),
            })
        except Exception as e:
            detailed_tables.append({
                "name": t_name,
                "status": "UNKNOWN",
                "error": str(e),
                "keys": [],
                "gsis": [],
                "lsis": [],
            })
    return detailed_tables

def _projection(p: Dict[str, Any]) -> Dict[str, Any]:
    proj_type = (p.get("projection_type") or "ALL").upper()
    proj: Dict[str, Any] = {"ProjectionType": proj_type}
    if proj_type == "INCLUDE":
        proj["NonKeyAttributes"] = [a.strip() for a in (p.get("non_key_attributes") or []) if a and a.strip()]
    return proj


def create_table_full(
    table_name: str,
    partition_key_name: str,
    partition_key_type: str = "S",
    sort_key_name: Optional[str] = None,
    sort_key_type: Optional[str] = "S",
    billing_mode: str = "PAY_PER_REQUEST",
    read_capacity_units: int = 5,
    write_capacity_units: int = 5,
    gsis: Optional[List[Dict]] = None,
    lsis: Optional[List[Dict]] = None,
) -> Dict:
    """
    CreateTable をそのまま呼ぶ。名前の長さ・キーの型・インデックス数などの検証は DynamoDB に任せる
    （違反すれば AWS と同じ ValidationException が返る）。
    """
    dynamo = get_client("dynamodb")
    attr_defs: Dict[str, str] = {}

    def define(name: str, typ: Optional[str]) -> None:
        attr_defs[name] = (typ or "S").upper()

    key_schema = [{"AttributeName": partition_key_name, "KeyType": "HASH"}]
    define(partition_key_name, partition_key_type)
    if sort_key_name:
        key_schema.append({"AttributeName": sort_key_name, "KeyType": "RANGE"})
        define(sort_key_name, sort_key_type)

    params: Dict[str, Any] = {"TableName": table_name, "KeySchema": key_schema}
    provisioned = billing_mode == "PROVISIONED"
    throughput = {"ReadCapacityUnits": read_capacity_units or 5, "WriteCapacityUnits": write_capacity_units or 5}
    params["BillingMode"] = "PROVISIONED" if provisioned else "PAY_PER_REQUEST"
    if provisioned:
        params["ProvisionedThroughput"] = throughput

    if gsis:
        gsi_list = []
        for g in gsis:
            schema = [{"AttributeName": g["partition_key"].strip(), "KeyType": "HASH"}]
            define(g["partition_key"].strip(), g.get("partition_key_type"))
            if g.get("sort_key"):
                schema.append({"AttributeName": g["sort_key"].strip(), "KeyType": "RANGE"})
                define(g["sort_key"].strip(), g.get("sort_key_type"))
            gsi: Dict[str, Any] = {"IndexName": g["name"].strip(), "KeySchema": schema, "Projection": _projection(g)}
            if provisioned:
                gsi["ProvisionedThroughput"] = throughput
            gsi_list.append(gsi)
        params["GlobalSecondaryIndexes"] = gsi_list

    if lsis:
        # LSI はテーブルと同じパーティションキー ＋ 別のソートキー。テーブルにソートキーが無ければ DynamoDB がエラーにする
        lsi_list = []
        for l in lsis:
            define(l["sort_key"].strip(), l.get("sort_key_type"))
            lsi_list.append({
                "IndexName": l["name"].strip(),
                "KeySchema": [
                    {"AttributeName": partition_key_name, "KeyType": "HASH"},
                    {"AttributeName": l["sort_key"].strip(), "KeyType": "RANGE"},
                ],
                "Projection": _projection(l),
            })
        params["LocalSecondaryIndexes"] = lsi_list

    params["AttributeDefinitions"] = [{"AttributeName": k, "AttributeType": v} for k, v in attr_defs.items()]
    res = dynamo.create_table(**params)
    return boto_safe(res.get("TableDescription", {}))


def boto_safe(obj: Any) -> Any:
    """datetime / Decimal / bytes を JSON にできる形へ"""
    if isinstance(obj, dict):
        return {k: boto_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [boto_safe(v) for v in obj]
    if isinstance(obj, (bytes, bytearray)):
        return base64.b64encode(bytes(obj)).decode()
    if isinstance(obj, Decimal):
        return str(obj)
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj


def delete_table(table_name: str) -> Dict:
    get_client("dynamodb").delete_table(TableName=table_name)
    return {"message": f"Table '{table_name}' deleted"}


def _key_types(table_name: str, index_name: Optional[str] = None) -> Tuple[Dict[str, str], List[str]]:
    """テーブル（またはインデックス）のキー属性名 → 型、キー属性名の並び（HASH, RANGE）"""
    desc = get_client("dynamodb").describe_table(TableName=table_name)["Table"]
    types = {a["AttributeName"]: a["AttributeType"] for a in desc.get("AttributeDefinitions", [])}
    schema = desc.get("KeySchema", [])
    if index_name:
        for ix in desc.get("GlobalSecondaryIndexes", []) + desc.get("LocalSecondaryIndexes", []):
            if ix.get("IndexName") == index_name:
                schema = ix.get("KeySchema", [])
                break
    names = [k["AttributeName"] for k in sorted(schema, key=lambda k: 0 if k["KeyType"] == "HASH" else 1)]
    return types, names


# --------------------------------------------------------------------------
# アイテム
# --------------------------------------------------------------------------
def scan_table_items(table_name: str, max_items: int = SCAN_MAX_ITEMS) -> List[Dict]:
    """Scan をページングしながら最大 max_items 件取得する"""
    dynamo = get_client("dynamodb")
    items: List[Dict] = []
    kwargs: Dict[str, Any] = {"TableName": table_name}
    while True:
        res = dynamo.scan(**kwargs)
        for it in res.get("Items", []):
            items.append(_format_item(it))
            if len(items) >= max_items:
                return items
        if not res.get("LastEvaluatedKey"):
            return items
        kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]


def query_table_items(
    table_name: str,
    key_conditions: Dict[str, Any],
    index_name: Optional[str] = None,
) -> List[Dict]:
    """
    Query（キーの等価条件）。値の型はテーブル / インデックスのキー定義から決める。
    値に DynamoDB JSON（{"N": "1"} など）を渡せばそのまま使う。
    """
    types, _ = _key_types(table_name, index_name)
    dynamo = get_client("dynamodb")
    parts, names, values = [], {}, {}
    for i, (k, v) in enumerate(key_conditions.items()):
        names[f"#k{i}"] = k
        if isinstance(v, dict) and len(v) == 1 and next(iter(v)) in ATTRIBUTE_TYPES:
            av = ddb_json_to_boto(v, k)
        else:
            av = ddb_json_to_boto(form_value_to_ddb_json(types.get(k, "S"), v, k), k)
        values[f":v{i}"] = av
        parts.append(f"#k{i} = :v{i}")
    params: Dict[str, Any] = {
        "TableName": table_name,
        "KeyConditionExpression": " AND ".join(parts),
        "ExpressionAttributeNames": names,
        "ExpressionAttributeValues": values,
    }
    if index_name:
        params["IndexName"] = index_name
    items: List[Dict] = []
    while True:
        res = dynamo.query(**params)
        items.extend(_format_item(it) for it in res.get("Items", []))
        if not res.get("LastEvaluatedKey") or len(items) >= SCAN_MAX_ITEMS:
            return items[:SCAN_MAX_ITEMS]
        params["ExclusiveStartKey"] = res["LastEvaluatedKey"]


def attributes_to_item(attributes: List[Dict]) -> Dict[str, Dict[str, Any]]:
    """画面の行（name / type / value）から DynamoDB JSON のアイテムを作る"""
    item: Dict[str, Dict[str, Any]] = {}
    for attr in attributes:
        name = (attr.get("name") or "").strip()
        if not name:
            continue
        if name in item:
            raise ItemFormatError(f"属性名「{name}」が重複しています")
        item[name] = form_value_to_ddb_json(attr.get("type", "S"), attr.get("value", ""), name)
    return item


def put_item(table_name: str, item: Dict[str, Any]) -> Dict:
    """PutItem（同じキーがあれば丸ごと置き換え）。item は DynamoDB JSON"""
    get_client("dynamodb").put_item(TableName=table_name, Item=item_to_boto(item))
    return {"message": "アイテムを保存しました", "item": item}


def put_or_update_item(table_name: str, attributes: List[Dict]) -> Dict:
    """画面の行形式で PutItem する（互換用）"""
    return put_item(table_name, attributes_to_item(attributes))


def delete_table_item(table_name: str, key_attributes: Dict[str, Dict]) -> Dict:
    """DeleteItem。key_attributes は DynamoDB JSON のキー（例: {"id": {"S": "1"}}）"""
    get_client("dynamodb").delete_item(TableName=table_name, Key=item_to_boto(key_attributes))
    return {"message": "アイテムを削除しました"}
