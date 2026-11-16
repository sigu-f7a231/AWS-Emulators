// Mailbox ページ（サーバーコンポーネント）
import SmtpSettingsCard from '../components/SmtpSettingsCard';
import DeliveryModeForm from '../components/DeliveryModeForm';
import { getSmtpStatus } from '../lib/smtp';

interface Email {
  id: string; to: string; subject: string; body: string;
  timestamp: string; from?: string;
  status?: string; error?: string | null;
}

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getEmails(): Promise<Email[]> {
  try {
    const res = await fetch(`${BACKEND}/api/mail/list`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.emails || data || [];
  } catch { return []; }
}

export default async function MailboxPage({
  searchParams,
}: {
  searchParams: { msg?: string; err?: string };
}) {
  const [emails, smtp] = await Promise.all([getEmails(), getSmtpStatus()]);

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>📧 Mailbox</h1>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      {/* SMTP 設定 */}
      <SmtpSettingsCard returnTo="/mailbox" />

      {/* テストメール送信 */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>✉️ テストメール送信</h2>
        <DeliveryModeForm action="/api/mail/send" smtpReady={smtp.ready} smtpLabel={`${smtp.host}:${smtp.port}`} submitLabel="📤 送信">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <input name="to" type="email" placeholder="送信先メールアドレス" required />
            <input name="subject" placeholder="件名" defaultValue="テストメール" />
            <textarea name="body" placeholder="本文" rows={4} defaultValue="ローカル環境からのテストメールです。" />
          </div>
        </DeliveryModeForm>
      </article>

      {/* 送信済みメール一覧 */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
          📮 送信済みメール ({emails.length} 件)
        </h2>
        {emails.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>送信済みメールがありません</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {emails.slice().reverse().map((email) => (
              <details key={email.id} style={{
                padding: '14px 16px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
              }}>
                <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{email.subject}</span>
                    <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      → {email.to}
                    </span>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {email.status && (
                      <span title={email.error || email.status} style={{
                        padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
                        backgroundColor: email.status.startsWith('smtp_error') ? 'rgba(239,68,68,0.15)'
                          : email.status.startsWith('delivered_smtp') ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                        color: email.status.startsWith('smtp_error') ? '#f87171'
                          : email.status.startsWith('delivered_smtp') ? '#34d399' : 'var(--text-muted)',
                      }}>
                        {email.status.startsWith('smtp_error') ? '❌ SMTP失敗'
                          : email.status.startsWith('delivered_smtp') ? '🌐 SMTP送信済' : '🧪 擬似送信済'}
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(email.timestamp).toLocaleString('ja-JP')}
                    </span>
                  </span>
                </summary>
                <pre style={{
                  marginTop: '12px', padding: '12px',
                  backgroundColor: 'var(--code-bg)', borderRadius: '6px',
                  color: '#38bdf8', fontSize: '13px', whiteSpace: 'pre-wrap',
                }}>
                  {email.body}
                </pre>
                {email.error && (
                  <div className="alert-message alert-error" style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px' }}>
                    SMTP エラー: {email.error}
                  </div>
                )}
              </details>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
