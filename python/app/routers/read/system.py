"""System - Read: ヘルスチェック / エミュレータ接続確認"""
from fastapi import APIRouter

from app.aws_client import test_connection

router = APIRouter()


@router.get("/api/health", summary="[System] ヘルスチェック", description="Python バックエンド自体が起動しているかを返します。")
def health():
    return {"status": "ok", "service": "python-backend"}


@router.get("/api/status", summary="[System] AWS Emulator への接続確認", description="S3 の ListBuckets で疎通を確認します。")
def get_status():
    return test_connection()
