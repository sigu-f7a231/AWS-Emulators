"""
DynamoDB の論理スキーマ管理（DB / テーブル / カラム / インデックス / 外部キー）

DynamoDB 自体には「データベース」「カラム定義」「外部キー」が無いため、このモジュールで補う。

- DB はテーブル名の接頭辞で表現する。DB「shop」のテーブル「users」の実テーブル名は `shop.users`
- カラム・必須・外部キーなどの定義は SCHEMA_FILE（コンテナ内の JSON）に保存する。コンテナ削除で消える
- アイテム保存時（put_or_update_item）に validate_item() で
  型・必須・外部キー（参照先テーブルに該当キーが存在するか）をチェックする
- 他テーブルから外部キーで参照されているテーブルは削除できない
"""
import json
import os
import re
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.aws_client import get_client

from app import config

# コンテナ内（ボリューム・バインドマウントなし）に保存 → コンテナを削除すると消える
SCHEMA_FILE = os.getenv("DYNAMO_SCHEMA_FILE", os.path.join(config.DATA_DIR, "dynamo_schema.json"))
SEPARATOR = "."

NAME_RE = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
INDEX_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,255}$")
KEY_TYPES = {"S", "N", "B"}
COLUMN_TYPES = {"S", "N", "B", "BOOL", "L", "M"}
PROJECTIONS = {"ALL", "KEYS_ONLY"}
MAX_GSI = 20
MAX_LSI = 5

_lock = threading.RLock()


class SchemaError(ValueError):
    """入力値・整合性のエラー（HTTP 400）"""


class SchemaNotFound(LookupError):
    """DB / テーブルが見つからない（HTTP 404）"""


# --------------------------------------------------------------------------
# 保存
# --------------------------------------------------------------------------
def _load() -> Dict[str, Any]:
    with _lock:
        if os.path.exists(SCHEMA_FILE):
            try:
                with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data.setdefault("databases", {})
                    return data
            except Exception:
                pass
        return {"version": 1, "databases": {}}


def _save(data: Dict[str, Any]) -> None:
    with _lock:
        os.makedirs(os.path.dirname(SCHEMA_FILE) or ".", exist_ok=True)
        tmp = SCHEMA_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, SCHEMA_FILE)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def physical_name(db_name: str, table_name: str) -> str:
    return f"{db_name}{SEPARATOR}{table_name}"


def _existing_physical_tables() -> Optional[set]:
    """実在するテーブル名一覧。エミュレータに繋がらない場合は None"""
    try:
        dynamo = get_client("dynamodb")
        names: List[str] = []
        kwargs: Dict[str, Any] = {}
        while True:
            res = dynamo.list_tables(**kwargs)
            names.extend(res.get("TableNames", []))
            last = res.get("LastEvaluatedTableName")
            if not last:
                break
            kwargs["ExclusiveStartTableName"] = last
        return set(names)
    except Exception:
        return None


def _check_name(kind: str, name: str) -> str:
    name = (name or "").strip()
    if not NAME_RE.match(name):
        raise SchemaError(f"{kind}名「{name}」は英数字・_・- の 1〜100 文字で指定してください（. は使えません）")
    return name


def _get_db(data: Dict[str, Any], db_name: str) -> Dict[str, Any]:
    db = data["databases"].get(db_name)
    if db is None:
        raise SchemaNotFound(f"DB「{db_name}」は存在しません")
    return db


def _get_table(db: Dict[str, Any], table_name: str) -> Dict[str, Any]:
    t = db["tables"].get(table_name)
    if t is None:
        raise SchemaNotFound(f"テーブル「{db['name']}.{table_name}」は存在しません")
    return t


# --------------------------------------------------------------------------
# 参照系
# --------------------------------------------------------------------------
def _relations(db: Dict[str, Any]) -> List[Dict[str, Any]]:
    rels = []
    for t in db["tables"].values():
        for fk in t.get("foreign_keys", []):
            rels.append({
                "name": fk["name"],
                "from_table": t["name"],
                "columns": fk["columns"],
                "to_table": fk["ref_table"],
                "ref_columns": fk["ref_columns"],
            })
    return rels


def _decorate_table(t: Dict[str, Any], existing: Optional[set], db: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(t)
    out["exists"] = None if existing is None else (t["physical_name"] in existing)
    out["referenced_by"] = [
        {"table": r["from_table"], "columns": r["columns"], "name": r["name"]}
        for r in _relations(db)
        if r["to_table"] == t["name"] and r["from_table"] != t["name"]
    ]
    return out


def list_databases() -> List[Dict[str, Any]]:
    data = _load()
    existing = _existing_physical_tables()
    result = []
    for db in sorted(data["databases"].values(), key=lambda d: d["name"]):
        result.append({
            "name": db["name"],
            "description": db.get("description", ""),
            "created_at": db.get("created_at"),
            "table_count": len(db["tables"]),
            "tables": [
                {
                    "name": t["name"],
                    "physical_name": t["physical_name"],
                    "exists": None if existing is None else (t["physical_name"] in existing),
                }
                for t in sorted(db["tables"].values(), key=lambda x: x["name"])
            ],
            "relation_count": len(_relations(db)),
        })
    return result


def get_database(db_name: str) -> Dict[str, Any]:
    data = _load()
    db = _get_db(data, db_name)
    existing = _existing_physical_tables()
    return {
        "name": db["name"],
        "description": db.get("description", ""),
        "created_at": db.get("created_at"),
        "tables": [_decorate_table(t, existing, db) for t in sorted(db["tables"].values(), key=lambda x: x["name"])],
        "relations": _relations(db),
    }


def get_table(db_name: str, table_name: str) -> Dict[str, Any]:
    data = _load()
    db = _get_db(data, db_name)
    t = _get_table(db, table_name)
    return _decorate_table(t, _existing_physical_tables(), db)


def find_by_physical(physical: str) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """実テーブル名から (db, table) を探す。管理外テーブルなら None"""
    if SEPARATOR not in physical:
        return None
    db_name, table_name = physical.split(SEPARATOR, 1)
    db = _load()["databases"].get(db_name)
    if not db:
        return None
    t = db["tables"].get(table_name)
    return (db, t) if t else None


def get_table_by_physical(physical: str) -> Dict[str, Any]:
    found = find_by_physical(physical)
    if not found:
        raise SchemaNotFound(f"テーブル「{physical}」のスキーマ定義はありません")
    db, t = found
    out = _decorate_table(t, None, db)
    out["database"] = db["name"]
    # 参照先テーブルのキー情報（アイテム画面でリンク表示に使う）
    for fk in out.get("foreign_keys", []):
        ref = db["tables"].get(fk["ref_table"])
        fk["ref_physical_name"] = ref["physical_name"] if ref else None
    return out


# --------------------------------------------------------------------------
# 作成・更新・削除
# --------------------------------------------------------------------------
def create_database(name: str, description: str = "") -> Dict[str, Any]:
    name = _check_name("DB", name)
    with _lock:
        data = _load()
        if name in data["databases"]:
            raise SchemaError(f"DB「{name}」は既に存在します")
        data["databases"][name] = {
            "name": name,
            "description": (description or "").strip(),
            "created_at": _now(),
            "tables": {},
        }
        _save(data)
    return {"name": name, "description": description, "tables": []}


def _normalize_columns(columns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not columns:
        raise SchemaError("カラムを 1 つ以上定義してください")
    seen = set()
    out = []
    for c in columns:
        name = (c.get("name") or "").strip()
        if not name:
            continue
        if name in seen:
            raise SchemaError(f"カラム名「{name}」が重複しています")
        ctype = (c.get("type") or "S").upper()
        if ctype not in COLUMN_TYPES:
            raise SchemaError(f"カラム「{name}」の型「{ctype}」は使えません（{', '.join(sorted(COLUMN_TYPES))}）")
        seen.add(name)
        out.append({
            "name": name,
            "type": ctype,
            "required": bool(c.get("required", False)),
            "description": (c.get("description") or "").strip(),
        })
    if not out:
        raise SchemaError("カラムを 1 つ以上定義してください")
    return out


def _key_column(cols: Dict[str, Dict[str, Any]], name: Optional[str], role: str) -> Dict[str, Any]:
    if not name:
        raise SchemaError(f"{role}を指定してください")
    c = cols.get(name)
    if not c:
        raise SchemaError(f"{role}「{name}」がカラムに定義されていません")
    if c["type"] not in KEY_TYPES:
        raise SchemaError(f"{role}「{name}」の型は S / N / B のいずれかにしてください（現在: {c['type']}）")
    return c


def _normalize_indexes(indexes: List[Dict[str, Any]], cols: Dict[str, Dict[str, Any]],
                       pk: str, sk: Optional[str]) -> List[Dict[str, Any]]:
    out = []
    seen = set()
    for ix in indexes or []:
        name = (ix.get("name") or "").strip()
        if not name:
            continue
        if not INDEX_NAME_RE.match(name):
            raise SchemaError(f"インデックス名「{name}」は英数字・_・-・. の 3〜255 文字で指定してください")
        if name in seen:
            raise SchemaError(f"インデックス名「{name}」が重複しています")
        seen.add(name)
        itype = (ix.get("type") or "GSI").upper()
        proj = (ix.get("projection_type") or "ALL").upper()
        if proj not in PROJECTIONS:
            raise SchemaError(f"インデックス「{name}」の射影は ALL / KEYS_ONLY のいずれかにしてください")
        ix_sk = (ix.get("sort_key") or "").strip() or None
        if itype == "GSI":
            ix_pk = (ix.get("partition_key") or "").strip()
            _key_column(cols, ix_pk, f"GSI「{name}」のパーティションキー")
            if ix_sk:
                _key_column(cols, ix_sk, f"GSI「{name}」のソートキー")
                if ix_sk == ix_pk:
                    raise SchemaError(f"GSI「{name}」のパーティションキーとソートキーが同じです")
            out.append({"name": name, "type": "GSI", "partition_key": ix_pk, "sort_key": ix_sk, "projection_type": proj})
        elif itype == "LSI":
            if not sk:
                raise SchemaError(f"LSI「{name}」を作るには、テーブルにソートキーが必要です")
            _key_column(cols, ix_sk, f"LSI「{name}」のソートキー")
            if ix_sk == sk:
                raise SchemaError(f"LSI「{name}」のソートキーがテーブルのソートキーと同じです")
            out.append({"name": name, "type": "LSI", "partition_key": pk, "sort_key": ix_sk, "projection_type": proj})
        else:
            raise SchemaError(f"インデックス「{name}」の種類は GSI / LSI のいずれかにしてください")
    if sum(1 for i in out if i["type"] == "GSI") > MAX_GSI:
        raise SchemaError(f"GSI は {MAX_GSI} 個までです")
    if sum(1 for i in out if i["type"] == "LSI") > MAX_LSI:
        raise SchemaError(f"LSI は {MAX_LSI} 個までです")
    return out


def _ref_keys(t: Dict[str, Any]) -> List[str]:
    keys = [t["primary_key"]["partition_key"]]
    if t["primary_key"].get("sort_key"):
        keys.append(t["primary_key"]["sort_key"])
    return keys


def _col_type(t: Dict[str, Any], col: str) -> Optional[str]:
    for c in t["columns"]:
        if c["name"] == col:
            return c["type"]
    return None


def _normalize_fks(fks: List[Dict[str, Any]], table: Dict[str, Any], db: Dict[str, Any]) -> List[Dict[str, Any]]:
    """外部キーは参照先テーブルの主キー（PK、SK があれば PK+SK）を参照する"""
    out = []
    seen = set()
    cols = {c["name"]: c for c in table["columns"]}
    for fk in fks or []:
        columns = [c.strip() for c in (fk.get("columns") or []) if c and c.strip()]
        ref_name = (fk.get("ref_table") or "").strip()
        if not columns and not ref_name:
            continue
        if not columns or not ref_name:
            raise SchemaError("外部キーには「カラム」と「参照先テーブル」の両方を指定してください")
        ref = table if ref_name == table["name"] else db["tables"].get(ref_name)
        if not ref:
            raise SchemaError(f"外部キーの参照先テーブル「{ref_name}」は DB「{db['name']}」にありません")
        ref_keys = _ref_keys(ref)
        if len(columns) != len(ref_keys):
            raise SchemaError(
                f"参照先「{ref_name}」の主キーは {' + '.join(ref_keys)} なので、外部キーのカラムも {len(ref_keys)} 個指定してください"
            )
        for col, ref_col in zip(columns, ref_keys):
            if col not in cols:
                raise SchemaError(f"外部キーのカラム「{col}」がこのテーブルのカラムに定義されていません")
            if cols[col]["type"] != _col_type(ref, ref_col):
                raise SchemaError(
                    f"外部キー {col} → {ref_name}.{ref_col} の型が一致しません（{cols[col]['type']} と {_col_type(ref, ref_col)}）"
                )
        name = (fk.get("name") or "").strip() or f"fk_{table['name']}_{'_'.join(columns)}_{ref_name}"
        if name in seen:
            raise SchemaError(f"外部キー名「{name}」が重複しています")
        seen.add(name)
        out.append({"name": name, "columns": columns, "ref_table": ref_name, "ref_columns": ref_keys})
    return out


def create_table(db_name: str, spec: Dict[str, Any]) -> Dict[str, Any]:
    """論理定義を検証し、実テーブル（DB名.テーブル名）を作成して定義を保存する"""
    from app.services.dynamo_service import create_table_full

    with _lock:
        data = _load()
        db = _get_db(data, db_name)
        name = _check_name("テーブル", spec.get("name", ""))
        if name in db["tables"]:
            raise SchemaError(f"テーブル「{db_name}.{name}」は既に定義されています")

        columns = _normalize_columns(spec.get("columns") or [])
        cols = {c["name"]: c for c in columns}
        pk = (spec.get("partition_key") or "").strip()
        sk = (spec.get("sort_key") or "").strip() or None
        pk_col = _key_column(cols, pk, "パーティションキー")
        sk_col = _key_column(cols, sk, "ソートキー") if sk else None
        if sk and sk == pk:
            raise SchemaError("パーティションキーとソートキーに同じカラムは指定できません")
        pk_col["required"] = True
        if sk_col:
            sk_col["required"] = True

        indexes = _normalize_indexes(spec.get("indexes") or [], cols, pk, sk)
        table = {
            "name": name,
            "physical_name": physical_name(db_name, name),
            "description": (spec.get("description") or "").strip(),
            "columns": columns,
            "primary_key": {"partition_key": pk, "sort_key": sk},
            "indexes": indexes,
            "foreign_keys": [],
            "billing_mode": spec.get("billing_mode") or "PAY_PER_REQUEST",
            "created_at": _now(),
        }
        table["foreign_keys"] = _normalize_fks(spec.get("foreign_keys") or [], table, db)

        create_table_full(
            table_name=table["physical_name"],
            partition_key_name=pk,
            partition_key_type=pk_col["type"],
            sort_key_name=sk,
            sort_key_type=sk_col["type"] if sk_col else "S",
            billing_mode=table["billing_mode"],
            read_capacity_units=int(spec.get("read_capacity_units") or 5),
            write_capacity_units=int(spec.get("write_capacity_units") or 5),
            gsis=[
                {
                    "name": i["name"],
                    "partition_key": i["partition_key"],
                    "partition_key_type": cols[i["partition_key"]]["type"],
                    "sort_key": i["sort_key"],
                    "sort_key_type": cols[i["sort_key"]]["type"] if i["sort_key"] else "S",
                    "projection_type": i["projection_type"],
                }
                for i in indexes if i["type"] == "GSI"
            ] or None,
            lsis=[
                {
                    "name": i["name"],
                    "sort_key": i["sort_key"],
                    "sort_key_type": cols[i["sort_key"]]["type"],
                    "projection_type": i["projection_type"],
                }
                for i in indexes if i["type"] == "LSI"
            ] or None,
        )

        db["tables"][name] = table
        _save(data)
        return table


def update_table(db_name: str, table_name: str, spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    定義だけを更新する（説明・カラム・外部キー）。
    主キーとインデックスは DynamoDB 上で変更できないため対象外。それらに使うカラムは削除・型変更できない。
    """
    with _lock:
        data = _load()
        db = _get_db(data, db_name)
        t = _get_table(db, table_name)

        columns = _normalize_columns(spec.get("columns") or t["columns"])
        cols = {c["name"]: c for c in columns}
        locked = set(_ref_keys(t))
        for ix in t.get("indexes", []):
            locked.add(ix["partition_key"])
            if ix.get("sort_key"):
                locked.add(ix["sort_key"])
        for name in locked:
            if name not in cols:
                raise SchemaError(f"カラム「{name}」は主キー/インデックスで使っているため削除できません")
            if cols[name]["type"] != _col_type(t, name):
                raise SchemaError(f"カラム「{name}」は主キー/インデックスで使っているため型を変更できません")
        for k in _ref_keys(t):
            cols[k]["required"] = True

        new_t = dict(t)
        new_t["columns"] = columns
        if "description" in spec and spec["description"] is not None:
            new_t["description"] = spec["description"].strip()
        if spec.get("foreign_keys") is not None:
            new_t["foreign_keys"] = _normalize_fks(spec["foreign_keys"], new_t, db)
        else:
            new_t["foreign_keys"] = _normalize_fks(t.get("foreign_keys", []), new_t, db)
        new_t["updated_at"] = _now()

        # 他テーブルの外部キーがこのテーブルの主キーを参照している → 主キーは不変なので影響なし
        db["tables"][table_name] = new_t
        _save(data)
        return new_t


def _delete_physical(physical: str) -> None:
    dynamo = get_client("dynamodb")
    try:
        dynamo.delete_table(TableName=physical)
    except Exception as e:
        if "ResourceNotFound" not in type(e).__name__ and "ResourceNotFound" not in str(e):
            raise


def delete_table(db_name: str, table_name: str) -> Dict[str, Any]:
    with _lock:
        data = _load()
        db = _get_db(data, db_name)
        t = _get_table(db, table_name)
        refs = [r for r in _relations(db) if r["to_table"] == table_name and r["from_table"] != table_name]
        if refs:
            names = ", ".join(sorted({f"{r['from_table']}({'+'.join(r['columns'])})" for r in refs}))
            raise SchemaError(f"テーブル「{table_name}」は {names} から外部キーで参照されているため削除できません。先に参照元の外部キーかテーブルを削除してください")
        _delete_physical(t["physical_name"])
        del db["tables"][table_name]
        _save(data)
    return {"message": f"テーブル「{db_name}.{table_name}」を削除しました"}


def delete_database(db_name: str, cascade: bool = False) -> Dict[str, Any]:
    with _lock:
        data = _load()
        db = _get_db(data, db_name)
        if db["tables"] and not cascade:
            raise SchemaError(f"DB「{db_name}」にはテーブルが {len(db['tables'])} 個あります。テーブルごと削除する場合は cascade=true を指定してください")
        for t in db["tables"].values():
            _delete_physical(t["physical_name"])
        del data["databases"][db_name]
        _save(data)
    return {"message": f"DB「{db_name}」を削除しました"}


def forget_physical(physical: str) -> None:
    """既存の「テーブル削除」API から呼ぶ。定義が残っていれば消す"""
    with _lock:
        found = find_by_physical(physical)
        if not found:
            return
        data = _load()
        db_name, table_name = physical.split(SEPARATOR, 1)
        data["databases"][db_name]["tables"].pop(table_name, None)
        _save(data)


def check_deletable_physical(physical: str) -> None:
    """管理対象テーブルが他から参照されていれば SchemaError"""
    found = find_by_physical(physical)
    if not found:
        return
    db, t = found
    refs = [r for r in _relations(db) if r["to_table"] == t["name"] and r["from_table"] != t["name"]]
    if refs:
        names = ", ".join(sorted({r["from_table"] for r in refs}))
        raise SchemaError(f"テーブル「{physical}」は {names} から外部キーで参照されているため削除できません")


# --------------------------------------------------------------------------
# アイテム検証
# --------------------------------------------------------------------------
def _attr_type(v: Dict[str, Any]) -> str:
    return next(iter(v.keys())) if v else ""


def _display(v: Dict[str, Any]) -> str:
    return str(next(iter(v.values()))) if v else ""


def validate_item(physical: str, item: Dict[str, Dict[str, Any]]) -> None:
    """
    アイテム保存前のチェック。DB に属さないテーブルへの保存は拒否する。
    - 型が定義と一致するか（NULL は必須でないカラムのみ可）
    - 必須カラムが入っているか（主キーは常に必須）
    - 外部キー: 値がすべて入っていれば、参照先テーブルに同じキーのアイテムがあるか
    定義に無い属性は DynamoDB らしくそのまま許可する。
    """
    found = find_by_physical(physical)
    if not found:
        raise SchemaError(
            f"テーブル「{physical}」はどの DB にも属していません。テーブルは DB の中に作成してください（DynamoDB 画面 → データベース）"
        )
    db, t = found
    errors: List[str] = []

    for c in t["columns"]:
        v = item.get(c["name"])
        if v is None:
            if c["required"]:
                errors.append(f"必須カラム「{c['name']}」がありません")
            continue
        at = _attr_type(v)
        if at == "NULL":
            if c["required"]:
                errors.append(f"必須カラム「{c['name']}」に NULL は入れられません")
            continue
        if at != c["type"]:
            errors.append(f"カラム「{c['name']}」は {c['type']} 型です（入力: {at}）")
    if errors:
        raise SchemaError(" / ".join(errors))

    dynamo = None
    for fk in t.get("foreign_keys", []):
        values = [item.get(col) for col in fk["columns"]]
        if any(v is None or _attr_type(v) == "NULL" for v in values):
            continue  # 値が無い外部キーはチェックしない（必須かどうかはカラム定義で判断）
        ref = t if fk["ref_table"] == t["name"] else db["tables"].get(fk["ref_table"])
        if not ref:
            errors.append(f"外部キー「{fk['name']}」の参照先テーブル「{fk['ref_table']}」の定義がありません")
            continue
        key = {ref_col: v for ref_col, v in zip(fk["ref_columns"], values)}
        # 自己参照で、自分自身を指している場合は OK
        if ref is t and all(item.get(k) == v for k, v in key.items()):
            continue
        dynamo = dynamo or get_client("dynamodb")
        try:
            res = dynamo.get_item(TableName=ref["physical_name"], Key=key, ConsistentRead=True)
        except Exception as e:
            errors.append(f"外部キー「{fk['name']}」の確認中にエラー: {e}")
            continue
        if not res.get("Item"):
            shown = ", ".join(f"{c}={_display(v)}" for c, v in zip(fk["columns"], values))
            errors.append(
                f"外部キー違反: {shown} に対応するアイテムが参照先「{fk['ref_table']}」({'+'.join(fk['ref_columns'])}) にありません"
            )
    if errors:
        raise SchemaError(" / ".join(errors))
