import os
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from datetime import datetime
from typing import List, Dict, Optional

from app import config

# コンテナ内に保存（コンテナを削除すると消える）
CONFIG_FILE = os.path.join(config.DATA_DIR, "smtp_config.json")
EMAILS_FILE = os.path.join(config.DATA_DIR, "sent_emails.json")

def _ensure_data_dir():
    os.makedirs(config.DATA_DIR, exist_ok=True)

def load_smtp_config() -> Dict:
    _ensure_data_dir()
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "smtp_host": os.getenv("SMTP_HOST", ""),
        "smtp_port": int(os.getenv("SMTP_PORT", "587")),
        "smtp_user": os.getenv("SMTP_USER", ""),
        "smtp_password": os.getenv("SMTP_PASSWORD", ""),
        "smtp_from": os.getenv("SMTP_FROM", "aws-emulator@local.test"),
        "is_enabled": bool(os.getenv("SMTP_HOST", "")),
    }

def save_smtp_config(config: Dict):
    _ensure_data_dir()
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

def load_sent_emails() -> List[Dict]:
    _ensure_data_dir()
    if os.path.exists(EMAILS_FILE):
        try:
            with open(EMAILS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def _save_sent_emails(emails: List[Dict]):
    _ensure_data_dir()
    with open(EMAILS_FILE, "w") as f:
        json.dump(emails, f, indent=2)

def _open_smtp(cfg: Dict) -> smtplib.SMTP:
    """Opens an authenticated SMTP connection based on the config (SSL for 465, STARTTLS otherwise)."""
    host = cfg.get("smtp_host", "").strip()
    port = int(cfg.get("smtp_port", 587))
    user = cfg.get("smtp_user", "").strip()
    password = cfg.get("smtp_password", "").strip()

    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=12)
        server.ehlo()
    else:
        server = smtplib.SMTP(host, port, timeout=12)
        server.ehlo()
        if server.has_extn("starttls"):
            server.starttls()
            server.ehlo()
    if user and password:
        server.login(user, password)
    return server

def public_smtp_config() -> Dict:
    """Config for display: the password itself is never returned."""
    cfg = dict(load_smtp_config())
    cfg["has_password"] = bool(cfg.get("smtp_password"))
    cfg["smtp_password"] = ""
    return cfg

def update_smtp_config(new_cfg: Dict) -> Dict:
    """Saves config. An empty password keeps the currently saved one unless clear_password is set."""
    current = load_smtp_config()
    clear = new_cfg.pop("clear_password", False)
    if not new_cfg.get("smtp_password") and not clear:
        new_cfg["smtp_password"] = current.get("smtp_password", "")
    if clear:
        new_cfg["smtp_password"] = ""
    save_smtp_config(new_cfg)
    return public_smtp_config()

def is_smtp_active(cfg: Optional[Dict] = None) -> bool:
    """実 SMTP 送信が有効か（有効フラグ ON かつホストあり）。False なら擬似送信モード"""
    cfg = cfg if cfg is not None else load_smtp_config()
    return bool(cfg.get("is_enabled") and (cfg.get("smtp_host") or "").strip())

class SmtpNotConfiguredError(ValueError):
    """送信方法に SMTP が指定されたが、SMTP が未設定（または無効）"""


DELIVERY_MODES = ("local", "smtp")


def ensure_delivery_mode(mode: Optional[str]) -> Optional[str]:
    """
    送信方法を検証する。送信・配信の前に呼ぶ（SNS 発行などの副作用より前）。
    - None    : 自動（SMTP が有効なら SMTP、無ければ擬似送信）。SQS タスク処理など選択肢の無い処理用
    - "local" : 擬似送信（SMTP が設定済みでも外部には送らない）
    - "smtp"  : SMTP で送信。未設定・無効なら SmtpNotConfiguredError
    """
    if mode is None:
        return None
    if mode not in DELIVERY_MODES:
        raise SmtpNotConfiguredError(f"送信方法「{mode}」は使えません（local / smtp）")
    if mode == "smtp" and not is_smtp_active():
        raise SmtpNotConfiguredError(
            "送信方法に SMTP が選ばれましたが、SMTP が設定されていません（または無効です）。"
            "SMTP 設定を保存して「実メール送信を有効にする」を ON にするか、擬似送信を選んでください"
        )
    return mode


def test_smtp_connection() -> Dict:
    """
    接続テスト。メールは送らない。
    - SMTP 未設定 / 無効: 擬似送信モード。設定不要でそのまま成功を返す（外部には何も送らない）
    - SMTP 有効: 実際に接続（＋認証）して結果を返す
    """
    cfg = load_smtp_config()
    if not is_smtp_active(cfg):
        return {
            "ok": True,
            "mode": "local",
            "detail": "擬似送信モードです（SMTP 設定不要）。メールは外部に送られず、送信済みとして Mailbox に記録されます",
        }
    host = cfg.get("smtp_host", "").strip()
    try:
        server = _open_smtp(cfg)
        server.quit()
        return {"ok": True, "mode": "smtp", "detail": f"{host}:{cfg.get('smtp_port')} に接続できました"}
    except Exception as e:
        return {"ok": False, "mode": "smtp", "detail": f"{type(e).__name__}: {e}"}

def send_email(
    to_address: str,
    subject: str,
    body: str,
    source: str = "direct",
    source_detail: str = "",
    delivery_mode: Optional[str] = None,
) -> Dict:
    """
    Sends an email:
    - 常に Mailbox（ローカル）に記録する
    - SMTP 未設定 / 無効: 擬似送信。status は "delivered_locally"（送信成功扱い）
    - SMTP 有効: 実際に送信。成功 "delivered_smtp (host)" / 失敗 "smtp_error: ..."
    """
    delivery_mode = ensure_delivery_mode(delivery_mode)
    smtp_cfg = load_smtp_config()
    smtp_host = smtp_cfg.get("smtp_host", "").strip()
    smtp_port = int(smtp_cfg.get("smtp_port", 587))
    smtp_user = smtp_cfg.get("smtp_user", "").strip()
    smtp_password = smtp_cfg.get("smtp_password", "").strip()
    smtp_from = smtp_cfg.get("smtp_from", "aws-emulator@local.test").strip()
    is_enabled = smtp_cfg.get("is_enabled", False)

    emails = load_sent_emails()

    # SMTP 未設定なら擬似送信（外部には送らず、送信済みとして Mailbox に記録する）
    delivery_status = "delivered_locally"
    error_detail = None

    # 送信方法: "local" は常に擬似送信、"smtp" は SMTP（検証済み）、None は SMTP が有効なら SMTP
    use_smtp = delivery_mode == "smtp" or (delivery_mode is None and is_enabled and smtp_host)
    if use_smtp:
        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_from
            msg["To"] = to_address
            msg["Subject"] = Header(subject, "utf-8")
            msg.attach(MIMEText(body, "plain", "utf-8"))

            with _open_smtp(smtp_cfg) as server:
                server.send_message(msg)
            delivery_status = f"delivered_smtp ({smtp_host})"
        except Exception as e:
            delivery_status = f"smtp_error: {str(e)}"
            error_detail = str(e)

    email_record = {
        "id": f"mail-{len(emails) + 1}",
        "to": to_address,
        "from": smtp_from,
        "subject": subject,
        "body": body,
        "timestamp": datetime.now().isoformat(),
        "source": source,
        "source_detail": source_detail,
        "status": delivery_status,
        "error": error_detail,
        "delivery_mode": "smtp" if use_smtp else "local",
    }

    emails.insert(0, email_record)
    _save_sent_emails(emails)
    return email_record

def list_sent_emails() -> List[Dict]:
    return load_sent_emails()

def clear_sent_emails():
    _save_sent_emails([])
