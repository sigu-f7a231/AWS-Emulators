"""S3 - Read: バケット一覧 / オブジェクト一覧 / オブジェクト取得"""
from fastapi import APIRouter, HTTPException, Path, Query

from app.aws_client import get_client

router = APIRouter()

BUCKET = Path(..., description="バケット名")


def _list_objects(bucket: str):
    s3 = get_client("s3")
    res = s3.list_objects_v2(Bucket=bucket)
    return [
        {"key": obj["Key"], "size": obj["Size"], "last_modified": str(obj["LastModified"])}
        for obj in res.get("Contents", [])
    ]


@router.get("/api/s3/buckets", summary="[S3] バケット一覧")
def list_buckets():
    try:
        s3 = get_client("s3")
        res = s3.list_buckets()
        return {"buckets": [b["Name"] for b in res.get("Buckets", [])]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/s3/buckets/{bucket_name}/objects", summary="[S3] オブジェクト一覧")
def list_objects(bucket_name: str = BUCKET):
    try:
        return {"bucket": bucket_name, "objects": _list_objects(bucket_name)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/api/s3/buckets/{bucket_name}/objects/{key:path}",
    summary="[S3] オブジェクトの内容を取得",
    description="UTF-8 として読めない場合は `is_text: false` とサイズだけを返します。",
)
def get_object_content(bucket_name: str = BUCKET, key: str = Path(..., description="オブジェクトキー（スラッシュを含んでもよい）")):
    try:
        s3 = get_client("s3")
        res = s3.get_object(Bucket=bucket_name, Key=key)
        body_bytes = res["Body"].read()
        try:
            content_str = body_bytes.decode("utf-8")
            is_text = True
        except UnicodeDecodeError:
            content_str = f"<Binary data: {len(body_bytes)} bytes>"
            is_text = False
        return {
            "bucket": bucket_name,
            "key": key,
            "size": res.get("ContentLength", len(body_bytes)),
            "content_type": res.get("ContentType", "application/octet-stream"),
            "content": content_str,
            "is_text": is_text,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/s3/objects", summary="[S3] オブジェクト一覧（フラット版）")
def list_objects_flat(bucket: str = Query(..., description="バケット名")):
    try:
        return {"objects": _list_objects(bucket)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
