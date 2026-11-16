from fastapi import HTTPException

from app.services.dynamo_service import ItemFormatError
from app.services.mail_service import SmtpNotConfiguredError
from app.services.sns_service import SubscriptionError


def to_http(e: Exception) -> HTTPException:
    """
    例外を HTTP エラーに変換する。
    - AWS（エミュレータ）が返したエラー: AWS と同じ HTTP ステータスで「エラーコード: メッセージ」を返す
      （例: 400 "ValidationException: ..."、400 "ResourceNotFoundException: ..."）
    - 入力値の変換エラー・SMTP 未設定・購読の承認エラー: 400
    - それ以外: 500
    """
    if isinstance(e, HTTPException):
        return e
    resp = getattr(e, "response", None)
    if isinstance(resp, dict) and isinstance(resp.get("Error"), dict):
        err = resp["Error"]
        status = resp.get("ResponseMetadata", {}).get("HTTPStatusCode") or 400
        if not (400 <= int(status) < 600):
            status = 400
        return HTTPException(status_code=int(status), detail=f"{err.get('Code', 'Error')}: {err.get('Message', str(e))}")
    if isinstance(e, (ItemFormatError, SmtpNotConfiguredError, SubscriptionError)):
        return HTTPException(status_code=400, detail=str(e))
    return HTTPException(status_code=500, detail=str(e))
