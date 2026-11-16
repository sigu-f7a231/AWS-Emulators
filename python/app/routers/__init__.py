"""
API ルーター（CRUD ごとにフォルダーを分割）

    routers/
      create/  … リソース・メッセージ・メールを新しく作る操作（主に POST）
      read/    … 状態を変えない参照・検索・接続確認（GET と一部の POST）
      update/  … 既存リソースや設定の更新（PUT / upsert の POST）
      delete/  … 削除（DELETE と一部の POST）

URL パスは従来から変えていない。
"""
from fastapi import APIRouter

from app.routers.create import router as create_router
from app.routers.read import router as read_router
from app.routers.update import router as update_router
from app.routers.delete import router as delete_router

api_router = APIRouter()
# 登録順は従来の main.py と同じ解決結果になるよう、Read → Create → Update → Delete の順にする
api_router.include_router(read_router)
api_router.include_router(create_router)
api_router.include_router(update_router)
api_router.include_router(delete_router)
