"""S3 - Create: バケット作成 / オブジェクトのアップロード"""
from fastapi import APIRouter, HTTPException, Path

from app import config
from app.aws_client import get_client
from app.schemas.s3 import CreateBucketRequest, PutObjectRequest, PutObjectFlatRequest

router = APIRouter()


@router.post("/api/s3/buckets", summary="[S3] バケットを作成")
def create_bucket(req: CreateBucketRequest):
    try:
        s3 = get_client("s3")
        if config.AWS_REGION == "us-east-1":
            s3.create_bucket(Bucket=req.bucket_name)
        else:
            s3.create_bucket(
                Bucket=req.bucket_name,
                CreateBucketConfiguration={"LocationConstraint": config.AWS_REGION},
            )
        return {"message": f"Bucket '{req.bucket_name}' created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/api/s3/buckets/{bucket_name}/objects",
    summary="[S3] オブジェクトをアップロード",
    description="同じキーが既にある場合は上書きされます。",
)
def put_object(req: PutObjectRequest, bucket_name: str = Path(..., description="バケット名")):
    try:
        s3 = get_client("s3")
        s3.put_object(Bucket=bucket_name, Key=req.key, Body=req.content.encode("utf-8"))
        return {"message": f"Object '{req.key}' uploaded to '{bucket_name}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/s3/objects", summary="[S3] オブジェクトをアップロード（フラット版）")
def put_object_flat(req: PutObjectFlatRequest):
    try:
        s3 = get_client("s3")
        s3.put_object(Bucket=req.bucket_name, Key=req.object_key, Body=req.content.encode("utf-8"))
        return {"message": f"'{req.object_key}' uploaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
