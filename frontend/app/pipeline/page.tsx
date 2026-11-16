// SNS-SQS パイプライン管理ページ（サーバーコンポーネント）
import SmtpSettingsCard from '../components/SmtpSettingsCard';
import DeliveryModeForm from '../components/DeliveryModeForm';
import { getSmtpStatus } from '../lib/smtp';

interface Topic { arn: string; name: string; }
interface Queue { url: string; name: string; }
interface Pipeline {
  id: string; topic_arn: string; topic_name: string;
  subscriptions: { type: 'email' | 'sqs'; endpoint: string; arn?: string }[];
}

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getTopics(): Promise<Topic[]> {
  try {
    const res = await fetch(`${BACKEND}/api/sns/topics`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.topics || data || []).map((t: any) => ({ arn: t.arn, name: t.name }));
  } catch { return []; }
}

async function getQueues(): Promise<Queue[]> {
  try {
    const res = await fetch(`${BACKEND}/api/sqs/queues`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.queues || data || []).map((q: any) => ({ url: q.url, name: q.name }));
  } catch { return []; }
}

async function getPipelines(): Promise<Pipeline[]> {
  try {
    const res = await fetch(`${BACKEND}/api/pipeline/list`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: { msg?: string; err?: string };
}) {
  const [topics, queues, pipelines, smtp] = await Promise.all([
    getTopics(), getQueues(), getPipelines(), getSmtpStatus(),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>🔗 SNS-SQS Pipeline 管理</h1>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      {/* 配信実行 */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>🚀 ブロードキャスト配信</h2>
        <DeliveryModeForm action="/api/pipeline/broadcast" smtpReady={smtp.ready} smtpLabel={`${smtp.host}:${smtp.port}`} submitLabel="📤 全サブスクライバーに配信">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            送信方法はメールサブスクライバー宛てのメールに適用されます。SQS キューへの転送はどちらでも行われます。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <select name="topic_arn" required>
              <option value="">── 配信先 SNS トピックを選択 ──</option>
              {topics.map(t => (
                <option key={t.arn} value={t.arn}>{t.name}</option>
              ))}
            </select>
            <input name="subject" placeholder="件名" defaultValue="【重要】システム通知" />
            <textarea name="message" rows={4} placeholder="メッセージ本文" defaultValue="SNSパイプライン経由のブロードキャストメッセージです。" />
          </div>
        </DeliveryModeForm>
      </article>

      {/* 既存パイプライン */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '20px', color: '#fff' }}>
          🔗 パイプライン一覧 ({pipelines.length})
        </h2>
        {pipelines.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>パイプラインがありません。SNSページでサブスクリプションを追加してください。</p>
        ) : pipelines.map((p) => (
          <div key={p.id} style={{
            padding: '16px', backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '12px',
          }}>
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: '#fff' }}>
              📣 {p.topic_name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(p.subscriptions || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '99px', fontSize: '11px',
                    backgroundColor: s.type === 'email' ? 'rgba(190,24,93,0.15)' : 'rgba(217,119,6,0.15)',
                    color: s.type === 'email' ? '#f9a8d4' : '#fcd34d',
                  }}>
                    {s.type === 'email' ? '📧 email' : '📬 sqs'}
                  </span>
                  <span style={{ color: '#f8fafc' }}>{s.endpoint}</span>
                </div>
              ))}
            </div>

            {/* メールサブスクリプション追加フォーム */}
            <details style={{ marginTop: '12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)' }}>
                ➕ メールアドレスを追加
              </summary>
              <form method="POST" action="/api/sns/subscribe" style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <input type="hidden" name="topic_arn" value={p.topic_arn} />
                <input type="hidden" name="redirect_pipeline" value="1" />
                <input name="email" type="email" placeholder="メールアドレス" style={{ flex: 1 }} />
                <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>登録</button>
              </form>
            </details>

            {/* SQS サブスクリプション追加 */}
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)' }}>
                ➕ SQS キューを紐付ける
              </summary>
              <form method="POST" action="/api/sns/subscribe-sqs" style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <input type="hidden" name="topic_arn" value={p.topic_arn} />
                <input type="hidden" name="redirect_pipeline" value="1" />
                <select name="queue_url" style={{ flex: 1 }}>
                  <option value="">── キューを選択 ──</option>
                  {queues.map(q => (
                    <option key={q.url} value={q.url}>{q.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>紐付け</button>
              </form>
            </details>
          </div>
        ))}
      </article>

      {/* SMTP 設定（メールサブスクライバーへの実送信） */}
      <SmtpSettingsCard returnTo="/pipeline" />

      {/* リソース作成 */}
      <div className="grid-2">
        <article className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#fff' }}>➕ SNS トピック作成</h2>
          <form method="POST" action="/api/sns/create-topic">
            <div className="form-group">
              <input name="topic_name" placeholder="トピック名" required />
              <button type="submit" className="btn-primary">作成</button>
            </div>
          </form>
        </article>
        <article className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#fff' }}>➕ SQS キュー作成</h2>
          <form method="POST" action="/api/sqs/create-queue">
            <div className="form-group">
              <input name="queue_name" placeholder="キュー名" required />
              <button type="submit" className="btn-primary">作成</button>
            </div>
          </form>
        </article>
      </div>
    </div>
  );
}
