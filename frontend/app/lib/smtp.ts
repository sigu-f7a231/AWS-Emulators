// サーバーコンポーネント用: SMTP が使える状態か（有効 かつ ホスト設定済み）
const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export interface SmtpStatus { ready: boolean; host: string; port: number; }

export async function getSmtpStatus(): Promise<SmtpStatus> {
  try {
    const res = await fetch(`${BACKEND}/api/smtp/config`, { cache: 'no-store' });
    if (!res.ok) return { ready: false, host: '', port: 0 };
    const c = await res.json();
    return { ready: !!(c.is_enabled && (c.smtp_host || '').trim()), host: c.smtp_host || '', port: c.smtp_port || 0 };
  } catch {
    return { ready: false, host: '', port: 0 };
  }
}
