import os

AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL", "https://aws-emulator:9297")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "emulator")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "emulator")
AWS_CA_BUNDLE = os.getenv("AWS_CA_BUNDLE", None)

# Port of FastAPI backend
PORT = int(os.getenv("PORT", "8000"))

# アプリのデータ（送信メール履歴・SMTP 設定）の保存先。
# コンテナ内のパスでボリュームもバインドマウントもしていないため、コンテナを削除するとデータも消える。
DATA_DIR = os.getenv("APP_DATA_DIR", "/data")

# 確認メール・通知メール内のリンク（承認 / 配信停止）の URL のベース。ブラウザから開ける Web UI の URL
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:3000").rstrip("/")
