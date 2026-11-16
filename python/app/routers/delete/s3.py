"""S3 - Delete: バケット削除 / オブジェクト削除"""
from fastapi import APIRouter, HTTPException, Path

from app.aws_client import get_client

router = APIRouter()


@router.delete("/api/s3/buckets/{bucket_name}", summary="[S3] バケットを削除", description="空のバケットのみ削除できます。")
def delete_bucket(bucket_name: str = Path(..., description="バケット名")):
    try:
        get_client("s3").delete_bucket(Bucket=bucket_name)
        return {"message": f"Bucket '{bucket_name}' deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/s3/buckets/{bucket_name}/objects/{key:path}", summary="[S3] オブジェクトを削除")
def delete_object(
    bucket_name: str = Path(..., description="バケット名"),
    key: str = Path(..., description="オブジェクトキー（スラッシュを含んでもよい）"),
):
    try:
        get_client("s3").delete_object(Bucket=bucket_name, Key=key)
        return {"message": f"Object '{key}' deleted from '{bucket_name}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
