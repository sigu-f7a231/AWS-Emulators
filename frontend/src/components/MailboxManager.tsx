import React, { useState, useEffect } from 'react';

interface SentEmail {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  timestamp: string;
  source: string; // 'sns', 'sqs', or 'direct'
  source_detail: string;
  status: string;
  error?: string;
}

interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password?: string;
  smtp_from: string;
  is_enabled: boolean;
}

export const MailboxManager: React.FC = () => {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);

  // Manual test send
  const [testTo, setTestTo] = useState('user@example.com');
  const [testSubject, setTestSubject] = useState('テストメール');
  const [testBody, setTestBody] = useState('これはローカル環境から送信されたテストメールです。');

  // SMTP Settings
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from: 'aws-emulator@local.test',
    is_enabled: false,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchEmails = async () => {
    try {
      const res = await fetch('/api/emails');
      const data = await res.json();
      if (res.ok) {
        setEmails(data.emails || []);
        if (data.emails?.length > 0 && !selectedEmail) {
          setSelectedEmail(data.emails[0]);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchSmtpConfig = async () => {
    try {
      const res = await fetch('/api/smtp/config');
      const data = await res.json();
      if (res.ok) {
        setSmtpConfig(data);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchSmtpConfig();
    const interval = setInterval(fetchEmails, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/smtp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: 'SMTP設定を保存しました！実メール送信が有効化されました。', isError: false });
        setShowSmtpSettings(false);
      } else {
        setMessage({ text: data.detail || '保存に失敗しました', isError: true });
      }
    } catch (e: any) {
      setMessage({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: testTo,
          subject: testSubject,
          body: testBody,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const sentRec = data.email;
        if (sentRec?.error) {
          setMessage({
            text: `メール処理されましたが、SMTP接続でエラーが発生しました: ${sentRec.error}`,
            isError: true,
          });
        } else {
          setMessage({
            text: `メール送信成功！ ステータス: [${sentRec.status}]`,
            isError: false,
          });
        }
        await fetchEmails();
        if (data.email) setSelectedEmail(data.email);
      } else {
        setMessage({ text: data.detail || '送信に失敗しました', isError: true });
      }
    } catch (e: any) {
      setMessage({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleClearEmails = async () => {
    if (!confirm('送信メール履歴をすべて消去しますか？')) return;
    try {
      await fetch('/api/emails', { method: 'DELETE' });
      setEmails([]);
      setSelectedEmail(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div>
      {message && (
        <div className={`alert-message ${message.isError ? 'alert-error' : 'alert-success'}`}>
          {message.text}
        </div>
      )}

      {/* Mode Status Banner */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 20px' }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            現在の送信モード:{' '}
          </span>
          {smtpConfig.is_enabled && smtpConfig.smtp_host ? (
            <span style={{ color: '#34d399', fontWeight: 700 }}>
              🌐 実メール送信モード (SMTP: {smtpConfig.smtp_host})
            </span>
          ) : (
            <span style={{ color: 'var(--aws-orange)', fontWeight: 700 }}>
              💻 ローカルモック送信モード (画面内のMailboxに記録)
            </span>
          )}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {smtpConfig.is_enabled && smtpConfig.smtp_host
              ? '実在のインターネットメールボックス宛てにメールが配送されます。'
              : '実在の自分のメールボックス（Gmail等）に送りたい場合は「⚙️ 実メール送信設定」を行ってください。'}
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={() => setShowSmtpSettings(!showSmtpSettings)}
          style={{ borderColor: 'var(--aws-orange)' }}
        >
          ⚙️ {showSmtpSettings ? '設定を閉じる' : '実メール送信設定 (SMTP)'}
        </button>
      </div>

      {/* Collapsible SMTP Configuration Panel */}
      {showSmtpSettings && (
        <div className="card" style={{ borderColor: 'var(--aws-orange)', backgroundColor: 'rgba(255, 153, 0, 0.05)' }}>
          <h2 className="card-title" style={{ fontSize: '16px', color: 'var(--aws-orange)' }}>
            ⚙️ 実メール送信（SMTP）の設定
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            お手持ちの Gmail（アプリパスワード使用）や会社のメールサーバーを設定すると、実在のメールアドレスに本物のメールが届きます。
          </p>

          <form onSubmit={handleSaveSmtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  SMTP ホスト (例: smtp.gmail.com):
                </label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpConfig.smtp_host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  SMTP ポート:
                </label>
                <input
                  type="number"
                  value={smtpConfig.smtp_port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value) || 587 })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  差出人アドレス (From):
                </label>
                <input
                  type="email"
                  placeholder="your-email@gmail.com"
                  value={smtpConfig.smtp_from}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  ユーザー名 / アカウント:
                </label>
                <input
                  type="text"
                  placeholder="your-email@gmail.com"
                  value={smtpConfig.smtp_user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  パスワード / アプリパスワード:
                </label>
                <input
                  type="password"
                  placeholder="Googleアプリパスワード等"
                  value={smtpConfig.smtp_password || ''}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                <input
                  type="checkbox"
                  id="enable_smtp"
                  checked={smtpConfig.is_enabled}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, is_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', flex: 'none' }}
                />
                <label htmlFor="enable_smtp" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  実メール送信を有効化する
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                設定を保存
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowSmtpSettings(false)}>
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Test Send Form */}
      <div className="card">
        <h2 className="card-title">📧 手動メール送信テスト</h2>
        <form onSubmit={handleSendTestEmail} className="form-group" style={{ marginBottom: 0 }}>
          <input
            type="email"
            placeholder="送信先 (例: user@example.com)"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            required
            style={{ maxWidth: '240px' }}
          />
          <input
            type="text"
            placeholder="件名"
            value={testSubject}
            onChange={(e) => setTestSubject(e.target.value)}
            required
            style={{ maxWidth: '240px' }}
          />
          <input
            type="text"
            placeholder="本文"
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            送信
          </button>
        </form>
      </div>

      <div className="grid-2">
        {/* Email Inbox/Sent list */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>
              📬 送信済みメール履歴 ({emails.length})
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={fetchEmails}>更新</button>
              {emails.length > 0 && (
                <button className="btn-secondary" onClick={handleClearEmails} style={{ color: '#ef4444' }}>
                  クリア
                </button>
              )}
            </div>
          </div>

          <div className="item-list">
            {emails.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                まだ送信されたメールはありません。「🚀 SNS×SQSメール配信」タブで配信ボタンを押すとここにリアルタイムで記録されます。
              </p>
            ) : (
              emails.map((m) => (
                <div
                  key={m.id}
                  className="item-row"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedEmail?.id === m.id ? 'var(--aws-orange)' : 'var(--border-color)',
                    backgroundColor: selectedEmail?.id === m.id ? 'rgba(255, 153, 0, 0.08)' : undefined,
                  }}
                  onClick={() => setSelectedEmail(m)}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>
                        To: {m.to}
                      </span>
                      <span
                        className="logo-badge"
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          background: m.source === 'sns' ? '#ec4899' : m.source === 'sqs' ? '#8b5cf6' : '#3b82f6',
                        }}
                      >
                        {m.source.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--aws-orange)', fontWeight: 500 }}>
                      {m.subject}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{m.source_detail}</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Email Detail Preview */}
        <div className="card">
          <h2 className="card-title">📄 メール本文プレビュー</h2>
          {!selectedEmail ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>左側からメールを選択してください。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>宛先 (To):</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmail.to}</span>

                  <span style={{ color: 'var(--text-muted)' }}>差出人 (From):</span>
                  <span>{selectedEmail.from}</span>

                  <span style={{ color: 'var(--text-muted)' }}>件名 (Subject):</span>
                  <span style={{ fontWeight: 600, color: 'var(--aws-orange)' }}>{selectedEmail.subject}</span>

                  <span style={{ color: 'var(--text-muted)' }}>送信日時:</span>
                  <span>{new Date(selectedEmail.timestamp).toLocaleString()}</span>

                  <span style={{ color: 'var(--text-muted)' }}>送信トリガー:</span>
                  <span>{selectedEmail.source.toUpperCase()} ({selectedEmail.source_detail})</span>

                  <span style={{ color: 'var(--text-muted)' }}>配信状態:</span>
                  <span style={{
                    color: selectedEmail.status.startsWith('delivered') ? '#10b981' : '#f87171',
                    fontWeight: 600,
                  }}>
                    {selectedEmail.status}
                  </span>
                </div>
                {selectedEmail.error && (
                  <div style={{ color: '#f87171', fontSize: '12px', marginTop: '8px', padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: '4px' }}>
                    エラー理由: {selectedEmail.error}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>本文:</h4>
                <div className="code-box" style={{ minHeight: '120px' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#f8fafc' }}>
                    {selectedEmail.body}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
