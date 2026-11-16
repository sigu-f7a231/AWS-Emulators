from pydantic import BaseModel, Field


class CreateBucketRequest(BaseModel):
    bucket_name: str = Field(..., description="作成するバケット名", examples=["my-local-bucket"])


class PutObjectRequest(BaseModel):
    key: str = Field(..., description="オブジェクトキー", examples=["docs/hello.txt"])
    content: str = Field(..., description="オブジェクトの内容（UTF-8 テキスト）", examples=["Hello, S3!"])


class PutObjectFlatRequest(BaseModel):
    bucket_name: str = Field(..., description="アップロード先バケット名", examples=["my-local-bucket"])
    object_key: str = Field(..., description="オブジェクトキー", examples=["docs/hello.txt"])
    content: str = Field("", description="オブジェクトの内容（UTF-8 テキスト）", examples=["Hello, S3!"])
