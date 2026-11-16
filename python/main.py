"""
AWS Emulator Python Bridge & API

- エンドポイントは app/routers/ 以下に CRUD ごとのフォルダーで分割している
    create/ read/ update/ delete/
- Swagger UI : http://localhost:8002/docs
- ReDoc      : http://localhost:8002/redoc
- OpenAPI    : http://localhost:8002/openapi.json
  （ファイルとして出力: python scripts/export_openapi.py → openapi/openapi.json, openapi.yaml）
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import api_router

API_VERSION = "1.2.0"

DESCRIPTION = """
ローカルの **AWS Emulator**（S3 / SQS / SNS / DynamoDB）を Boto3 で操作する API と、
メール送信（Mailbox / SMTP）・SNS→Email/SQS パイプラインを提供します。

### 構成
エンドポイントは **CRUD ごと**にグループ分けしています（ソースも `app/routers/<crud>/` に分割）。
各エンドポイントの概要の先頭 `[S3]` `[SQS]` などが対象サービスです。

| グループ | 内容 |
| :--- | :--- |
| **Create** | リソース・メッセージ・メールを新しく作る |
| **Read** | 状態を変えない参照・検索・接続確認 |
| **Update** | 既存リソースや設定の更新（upsert を含む） |
| **Delete** | 削除 |

### エラー
失敗時は HTTP 500 と `{"detail": "エラー内容"}` を返します。入力値の不備は 422 です。
"""

OPENAPI_TAGS = [
    {"name": "Create", "description": "作成系：S3 バケット/オブジェクト、SQS キュー/メッセージ、SNS トピック/購読/発行、メール送信、DynamoDB テーブル"},
    {"name": "Read", "description": "参照系：一覧・取得・検索（DynamoDB Query）、SMTP 設定取得・接続テスト、ヘルスチェック"},
    {"name": "Update", "description": "更新系：SMTP 設定の保存、DynamoDB アイテムの追加・上書き"},
    {"name": "Delete", "description": "削除系：S3 / SQS / SNS / DynamoDB のリソース、購読解除、Mailbox の記録"},
]

app = FastAPI(
    title="AWS Emulator Python Bridge & API",
    description=DESCRIPTION,
    version=API_VERSION,
    openapi_tags=OPENAPI_TAGS,
    servers=[
        {"url": "http://localhost:8002", "description": "ホスト PC から（docker compose の公開ポート）"},
        {"url": "http://python:8000", "description": "docker compose ネットワーク内（frontend コンテナから）"},
    ],
    swagger_ui_parameters={"docExpansion": "none", "filter": True, "tryItOutEnabled": True},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
