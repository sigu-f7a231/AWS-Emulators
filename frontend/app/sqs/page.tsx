// SQS 管理ページ（サーバーコンポーネント）
interface QueueInfo { name: string; url: string; message_count?: number; }
interface SqsMessage { message_id: string; body: string; receipt_handle: string; }

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getQueues(): Promise<QueueInfo[]> {
  try {
    const res = await fetch(`${BACKEND}/api/sqs/queues`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.queues || data || [];
  } catch { return []; }
}

async function getMessages(queueUrl: string): Promise<SqsMessage[]> {
  try {
    const res = await fetch(`${BACKEND}/api/sqs/messages?queue_url=${encodeURIComponent(queueUrl)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || data || [];
  } catch { return []; }
}

export default async function SqsPage({
  searchParams,
}: {
  searchParams: { queue?: string; msg?: string; err?: string };
}) {
  const queues = await getQueues();
  const selectedUrl = searchParams.queue ? decodeURIComponent(searchParams.queue) : '';
  const selectedQueue = queues.find(q => q.url === selectedUrl);
  const messages = selectedUrl ? await getMessages(selectedUrl) : [];

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>📬 SQS キュー管理</h1>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      <div className="grid-2">
        {/* キュー作成 */}
        <article className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>➕ キュー作成</h2>
          <form method="POST" action="/api/sqs/create-queue">
            <div className="form-group">
              <input name="queue_name" placeholder="キュー名 (例: my-queue)" required />
              <button type="submit" className="btn-primary">作成</button>
            </div>
          </form>
        </article>

        {/* キュー一覧 */}
        <article className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
            📋 キュー一覧 ({queues.length})
          </h2>
          <div className="item-list">
            {queues.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>キューがありません</p>
            ) : queues.map((q) => (
              <div key={q.url} className="item-row">
                <div>
                  <span className="item-name">📬 {q.name}</span>
                  {q.message_count != null && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {q.message_count} msgs
                    </span>
                  )}
                </div>
                <a
                  href={`/sqs?queue=${encodeURIComponent(q.url)}`}
                  style={{
                    padding: '4px 12px', fontSize: '13px', borderRadius: '6px',
                    backgroundColor: selectedUrl === q.url ? 'rgba(255,153,0,0.15)' : 'var(--bg-secondary)',
                    border: selectedUrl === q.url ? '1px solid var(--aws-orange)' : '1px solid var(--border-color)',
                    color: selectedUrl === q.url ? 'var(--aws-orange)' : 'var(--text-main)',
                    textDecoration: 'none', flexShrink: 0,
                  }}
                >
                  管理
                </a>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* メッセージ操作 */}
      {selectedQueue && (
        <>
          <article className="card">
            <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
              ✉️ {selectedQueue.name} — メッセージ送信
            </h2>
            <form method="POST" action="/api/sqs/send-message">
              <input type="hidden" name="queue_url" value={selectedQueue.url} />
              <input type="hidden" name="redirect_queue" value={selectedUrl} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <textarea name="message_body" placeholder="メッセージ本文" rows={3} required />
              </div>
              <button type="submit" className="btn-primary">📤 送信</button>
            </form>
          </article>

          <article className="card">
            <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
              📨 メッセージ一覧 ({messages.length} 件)
            </h2>
            <div className="item-list">
              {messages.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>メッセージがありません</p>
              ) : messages.map((m) => (
                <div key={m.message_id} style={{
                  padding: '14px 16px', backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)', borderRadius: '10px',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '6px' }}>
                    ID: {m.message_id}
                  </div>
                  <pre style={{ color: '#f8fafc', fontSize: '13px', whiteSpace: 'pre-wrap', margin: 0 }}>{m.body}</pre>
                </div>
              ))}
            </div>
          </article>
        </>
      )}
    </div>
  );
}
