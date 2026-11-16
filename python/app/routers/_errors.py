from fastapi import HTTPException

from app.services.mail_service import SmtpNotConfiguredError
from app.services.schema_service import SchemaError, SchemaNotFound


def to_http(e: Exception) -> HTTPException:
    """schema_service の例外を HTTP ステータスに変換（入力不備 400 / 見つからない 404 / その他 500）"""
    if isinstance(e, HTTPException):
        return e
    if isinstance(e, SchemaNotFound):
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, (SchemaError, SmtpNotConfiguredError)):
        return HTTPException(status_code=400, detail=str(e))
    return HTTPException(status_code=500, detail=str(e))
