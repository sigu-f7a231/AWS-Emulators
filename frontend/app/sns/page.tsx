// SNS 管理ページ（サーバーコンポーネント）
interface TopicInfo { arn: string; name: string; subscriptions?: SubInfo[]; }
interface SubInfo { arn: string; protocol: string; endpoint: string; }

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getTopics(): Promise<TopicInfo[]> {
  try {
    const res = await fetch(`${BACKEND}/api/sns/topics`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.topics || data || [];
  } catch { return []; }
}

export default async function SnsPage({
  searchParams,
}: {
  searchParams: { topic?: string; msg?: string; err?: string };
}) {
  const topics = await getTopics();
  const selectedArn = searchParams.topic || '';
  const selectedTopic = topics.find(t => t.arn === selectedArn);

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>📣 SNS 管理</h1>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      <div className="grid-2">
        {/* トピック作成 */}
        <article className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>➕ トピック作成</h2>
          <form method="POST" action="/api/sns/create-topic">
            <div className="form-group">
              <input name="topic_name" placeholder="トピック名 (例: Alerts)" required />
              <button type="submit" className="btn-primary">作成</button>
            </div>
          </form>
        </article>

        {/* トピック一覧 */}
        <article className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
            📋 トピック一覧 ({topics.length})
          </h2>
          <div className="item-list">
            {topics.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>トピックがありません</p>
            ) : topics.map((t) => (
              <div key={t.arn} className="item-row">
                <div>
                  <span className="item-name">📣 {t.name}</span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                    {t.arn}
                  </div>
                </div>
                <a
                  href={`/sns?topic=${encodeURIComponent(t.arn)}`}
                  style={{
                    padding: '4px 12px', fontSize: '13px', borderRadius: '6px',
                    backgroundColor: selectedArn === t.arn ? 'rgba(255,153,0,0.15)' : 'var(--bg-secondary)',
                    border: selectedArn === t.arn ? '1px solid var(--aws-orange)' : '1px solid var(--border-color)',
                    color: selectedArn === t.arn ? 'var(--aws-orange)' : 'var(--text-main)',
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

      {/* 選択中のトピック詳細 */}
      {selectedTopic && (
        <>
          {/* メールサブスクリプション追加 */}
          <article className="card">
            <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
              ✉️ {selectedTopic.name} — メールサブスクリプション追加
            </h2>
            <form method="POST" action="/api/sns/subscribe">
              <input type="hidden" name="topic_arn" value={selectedTopic.arn} />
              <input type="hidden" name="redirect_topic" value={selectedArn} />
              <div className="form-group">
                <input name="email" type="email" placeholder="メールアドレス" required />
                <button type="submit" className="btn-primary">📧 登録</button>
              </div>
            </form>

            {/* サブスクリプション一覧 */}
            {(selectedTopic.subscriptions ?? []).length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>登録済みサブスクリプション</h3>
                <div className="item-list">
                  {(selectedTopic.subscriptions ?? []).map((s) => (
                    <div key={s.arn} className="item-row">
                      <span>
                        <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                          {s.protocol}
                        </span>
                        {' '}{s.endpoint}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* メッセージ配信 */}
          <article className="card">
            <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
              🚀 {selectedTopic.name} — メッセージ配信
            </h2>
            <form method="POST" action="/api/sns/publish">
              <input type="hidden" name="topic_arn" value={selectedTopic.arn} />
              <input type="hidden" name="redirect_topic" value={selectedArn} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <input name="subject" placeholder="件名" defaultValue="テスト通知" />
                <textarea name="message" placeholder="メッセージ本文" rows={4} defaultValue="SNSトピックからの配信テストです。" />
              </div>
              <button type="submit" className="btn-primary">📤 配信する</button>
            </form>
          </article>
        </>
      )}
    </div>
  );
}
