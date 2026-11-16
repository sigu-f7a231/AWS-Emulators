import json
from typing import Dict, List, Any, Optional
from app.aws_client import get_client

def list_tables_with_details() -> List[Dict]:
    """Lists all tables with their complete key schema, GSI, LSI, attributes, and settings."""
    dynamo = get_client("dynamodb")
    tables_res = dynamo.list_tables()
    table_names = tables_res.get("TableNames", [])

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
    Creates a DynamoDB table with complete support for:
    - Partition Key & Sort Key with types (S, N, B)
    - Billing Mode (PAY_PER_REQUEST or PROVISIONED)
    - Global Secondary Indexes (GSI)
    - Local Secondary Indexes (LSI)
    - Projection configurations
    """
    dynamo = get_client("dynamodb")

    key_schema = [{"AttributeName": partition_key_name, "KeyType": "HASH"}]
    attr_definitions_map = {partition_key_name: partition_key_type}

    if sort_key_name:
        key_schema.append({"AttributeName": sort_key_name, "KeyType": "RANGE"})
        attr_definitions_map[sort_key_name] = sort_key_type or "S"

    params: Dict[str, Any] = {
        "TableName": table_name,
        "KeySchema": key_schema,
    }

    if billing_mode == "PROVISIONED":
        params["BillingMode"] = "PROVISIONED"
        params["ProvisionedThroughput"] = {
            "ReadCapacityUnits": read_capacity_units or 5,
            "WriteCapacityUnits": write_capacity_units or 5,
        }
    else:
        params["BillingMode"] = "PAY_PER_REQUEST"

    # Process Global Secondary Indexes (GSI)
    if gsis:
        gsi_list = []
        for g in gsis:
            g_name = g["name"].strip()
            g_pk = g["partition_key"].strip()
            g_pk_type = g.get("partition_key_type", "S")
            g_sk = g.get("sort_key", "").strip() if g.get("sort_key") else None
            g_sk_type = g.get("sort_key_type", "S")
            proj_type = g.get("projection_type", "ALL")

            attr_definitions_map[g_pk] = g_pk_type
            g_schema = [{"AttributeName": g_pk, "KeyType": "HASH"}]
            if g_sk:
                attr_definitions_map[g_sk] = g_sk_type
                g_schema.append({"AttributeName": g_sk, "KeyType": "RANGE"})

            gsi_def: Dict[str, Any] = {
                "IndexName": g_name,
                "KeySchema": g_schema,
                "Projection": {"ProjectionType": proj_type},
            }
            if billing_mode == "PROVISIONED":
                gsi_def["ProvisionedThroughput"] = {
                    "ReadCapacityUnits": read_capacity_units or 5,
                    "WriteCapacityUnits": write_capacity_units or 5,
                }
            gsi_list.append(gsi_def)
        params["GlobalSecondaryIndexes"] = gsi_list

    # Process Local Secondary Indexes (LSI)
    if lsis and sort_key_name:
        lsi_list = []
        for l in lsis:
            l_name = l["name"].strip()
            l_sk = l["sort_key"].strip()
            l_sk_type = l.get("sort_key_type", "S")
            proj_type = l.get("projection_type", "ALL")

            attr_definitions_map[l_sk] = l_sk_type
            lsi_list.append({
                "IndexName": l_name,
                "KeySchema": [
                    {"AttributeName": partition_key_name, "KeyType": "HASH"},
                    {"AttributeName": l_sk, "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": proj_type},
            })
        params["LocalSecondaryIndexes"] = lsi_list

    params["AttributeDefinitions"] = [
        {"AttributeName": k, "AttributeType": v} for k, v in attr_definitions_map.items()
    ]

    res = dynamo.create_table(**params)
    return res.get("TableDescription", {})

def scan_table_items(table_name: str) -> List[Dict]:
    """Scans and returns all items with parsed attributes and data types."""
    dynamo = get_client("dynamodb")
    res = dynamo.scan(TableName=table_name)
    raw_items = res.get("Items", [])

    formatted_items = []
    for item in raw_items:
        parsed_attributes = {}
        for k, v in item.items():
            data_type = list(v.keys())[0]
            raw_val = list(v.values())[0]

            if data_type == "BOOL":
                val = bool(raw_val)
            elif data_type == "N":
                val = float(raw_val) if "." in str(raw_val) else int(raw_val)
            elif data_type == "NULL":
                val = None
            else:
                val = str(raw_val)

            parsed_attributes[k] = {
                "type": data_type,
                "value": val,
                "raw_dynamo": v,
            }

        formatted_items.append({
            "_raw": item,
            "attributes": parsed_attributes,
        })

    return formatted_items

def query_table_items(
    table_name: str,
    key_conditions: Dict[str, Any],
    index_name: Optional[str] = None,
) -> List[Dict]:
    """
    Executes a Query operation against a table or a Secondary Index.
    """
    dynamo = get_client("dynamodb")
    params: Dict[str, Any] = {"TableName": table_name}
    if index_name:
        params["IndexName"] = index_name

    expr_parts = []
    expr_names = {}
    expr_values = {}

    idx = 0
    for k, v in key_conditions.items():
        name_placeholder = f"#k{idx}"
        val_placeholder = f":v{idx}"
        expr_parts.append(f"{name_placeholder} = {val_placeholder}")
        expr_names[name_placeholder] = k

        # Guess or format value
        if isinstance(v, (int, float)):
            expr_values[val_placeholder] = {"N": str(v)}
        elif isinstance(v, bool):
            expr_values[val_placeholder] = {"BOOL": v}
        else:
            expr_values[val_placeholder] = {"S": str(v)}
        idx += 1

    params["KeyConditionExpression"] = " AND ".join(expr_parts)
    params["ExpressionAttributeNames"] = expr_names
    params["ExpressionAttributeValues"] = expr_values

    res = dynamo.query(**params)
    formatted = []
    for item in res.get("Items", []):
        parsed = {}
        for k, v in item.items():
            dtype = list(v.keys())[0]
            rval = list(v.values())[0]
            parsed[k] = {"type": dtype, "value": rval, "raw_dynamo": v}
        formatted.append({"_raw": item, "attributes": parsed})
    return formatted

def format_value_to_dynamo(data_type: str, value: Any) -> Dict:
    """Converts a data type and python value into DynamoDB AttributeValue format."""
    data_type = data_type.upper()
    val_str = str(value)

    if data_type == "S":
        return {"S": val_str}
    elif data_type == "N":
        return {"N": str(val_str).strip() or "0"}
    elif data_type == "BOOL":
        return {"BOOL": str(value).lower() in ("true", "1", "yes")}
    elif data_type == "L":
        try:
            arr = json.loads(val_str) if val_str.startswith("[") else [x.strip() for x in val_str.split(",")]
            return {"L": [{"S": str(x)} for x in arr]}
        except Exception:
            return {"L": [{"S": val_str}]}
    elif data_type == "M":
        try:
            obj = json.loads(val_str)
            return {"M": {k: {"S": str(v)} for k, v in obj.items()}}
        except Exception:
            return {"M": {"raw": {"S": val_str}}}
    elif data_type == "NULL":
        return {"NULL": True}
    else:
        return {"S": val_str}

def put_or_update_item(table_name: str, attributes: List[Dict]) -> Dict:
    """Puts or updates an item in DynamoDB with exact data types."""
    dynamo = get_client("dynamodb")
    item_payload = {}
    for attr in attributes:
        name = attr["name"].strip()
        data_type = attr.get("type", "S")
        val = attr.get("value", "")
        if name:
            item_payload[name] = format_value_to_dynamo(data_type, val)

    # DB/テーブル設計（schema_service）で管理しているテーブルなら、型・必須・外部キーを検証
    from app.services.schema_service import validate_item
    validate_item(table_name, item_payload)

    dynamo.put_item(
        TableName=table_name,
        Item=item_payload,
    )
    return {"message": "アイテムを保存しました", "item": item_payload}

def delete_table_item(table_name: str, key_attributes: Dict[str, Dict]) -> Dict:
    """Deletes an item by its primary key."""
    dynamo = get_client("dynamodb")
    dynamo.delete_item(
        TableName=table_name,
        Key=key_attributes,
    )
    return {"message": "アイテムを削除しました"}
