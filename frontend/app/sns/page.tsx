// SNS 管理ページ（サーバーコンポーネント）
// AWS コンソールと同じ流れ: トピックの作成（タイプ / 名前 / 表示名）→ サブスクリプションの作成（トピック ARN / プロトコル / エンドポイント）
import SubscriptionStatus from '../components/SubscriptionStatus';
import DeliveryModeForm from '../components/DeliveryModeForm';
import SmtpSettingsCard from '../components/SmtpSettingsCard';
import CreateTopicForm from '../components/sns/CreateTopicForm';
import CreateSubscriptionForm from '../components/sns/CreateSubscriptionForm';
import { getSmtpStatus } from '../lib/smtp';

interface TopicInfo { arn: string; name: string; type?: 'standard' | 'fifo'; display_name?: string; content_based_deduplication?: boolean; }
interface SubInfo { arn: string; protocol: string; endpoint: string; status?: string; }

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getTopics(): Promise<TopicInfo[]> {
  try {
    const res = await fetch(`${BACKEND}/api/sns/topics`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.topics || [];
  } catch { return []; }
}

async function getSubscriptions(topicArn: string): Promise<SubInfo[]> {
  try {
    const res = await fetch(`${BACKEND}/api/sns/topics/${encodeURIComponent(topicArn)}/subscriptions`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.subscriptions || [];
  } catch { return []; }
}

const h2: React.CSSProperties = { fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' };
const typeBadge = (t?: string): React.CSSProperties => ({
  fontSize: '11px', padding: '1px 8px', borderRadius: '99px', whiteSpace: 'nowrap',
  backgroundColor: t === 'fifo' ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.15)',
  color: t === 'fifo' ? '#38bdf8' : 'var(--text-muted)',
});

export default async function SnsPage({
  searchParams,
}: {
  searchParams: { topic?: string; msg?: string; err?: string };
}) {
  const [topics, smtp] = await Promise.all([getTopics(), getSmtpStatus()]);
  const selectedArn = searchParams.topic || (topics.length === 1 ? topics[0].arn : '');
  const found = topics.find(t => t.arn === selectedArn);
  const selectedTopic = found ? { ...found, subscriptions: await getSubscriptions(found.arn) } : undefined;
  const here = found ? `/sns?topic=${encodeURIComponent(found.arn)}` : '/sns';
  const smtpLabel = `${smtp.host}:${smtp.port}`;
  const isFifo = selectedTopic?.type === 'fifo';

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>📣 SNS</h1>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      <div className="grid-2">
        {/* トピックの作成 */}
        <article className="card">
          <h2 style={h2}>➕ トピックの作成</h2>
          <CreateTopicForm />
        </article>

        {/* トピック一覧 */}
        <article className="card">
          <h2 style={h2}>📋 トピック ({topics.length})</h2>
          <div className="item-list">
            {topics.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>トピックがありません</p>
            ) : topics.map((t) => (
              <div key={t.arn} className="item-row" style={{ gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="item-name">📣 {t.name} <span style={typeBadge(t.type)}>{t.type === 'fifo' ? 'FIFO' : 'スタンダード'}</span></span>
                  {t.display_name && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>表示名: {t.display_name}</div>}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{t.arn}</div>
                </div>
                <a href={`/sns?topic=${encodeURIComponent(t.arn)}`} style={{
                  padding: '4px 12px', fontSize: '13px', borderRadius: '6px', flexShrink: 0, textDecoration: 'none',
                  backgroundColor: selectedArn === t.arn ? 'rgba(255,153,0,0.15)' : 'var(--bg-secondary)',
                  border: selectedArn === t.arn ? '1px solid var(--aws-orange)' : '1px solid var(--border-color)',
                  color: selectedArn === t.arn ? 'var(--aws-orange)' : 'var(--text-main)',
                }}>詳細</a>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* サブスクリプションの作成 */}
      <article className="card" id="create-subscription">
        <h2 style={h2}>✉️ サブスクリプションの作成</h2>
        {topics.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>先にトピックを作成してください。</p>
        ) : (
          <CreateSubscriptionForm
            topics={topics.map(t => ({ arn: t.arn, name: t.name, type: t.type }))}
            defaultTopicArn={selectedArn}
            smtpReady={smtp.ready}
            smtpLabel={smtpLabel}
          />
        )}
      </article>

      {/* 選択中のトピックの詳細 */}
      {selectedTopic && (
        <>
          <article className="card">
            <h2 style={h2}>
              📣 {selectedTopic.name} <span style={typeBadge(selectedTopic.type)}>{isFifo ? 'FIFO' : 'スタンダード'}</span>
              <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>— サブスクリプション</span>
            </h2>
            {selectedTopic.subscriptions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>サブスクリプションはまだありません。上の「サブスクリプションの作成」から登録してください。</p>
            ) : (
              <div className="item-list">
                {selectedTopic.subscriptions.map((s) => (
                  <div key={s.arn} className="item-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                        {s.protocol === 'email' ? 'Eメール' : s.protocol}
                      </span>
                      {' '}{s.endpoint}
                    </span>
                    <SubscriptionStatus status={s.status} subscriptionArn={s.arn} returnTo={here} smtpReady={smtp.ready} />
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="card">
            <h2 style={h2}>🚀 {selectedTopic.name} — メッセージの発行</h2>
            <DeliveryModeForm action="/api/sns/publish" smtpReady={smtp.ready} smtpLabel={smtpLabel}
              submitLabel="📤 メッセージの発行" label="通知メールの送信方法">
              <input type="hidden" name="topic_arn" value={selectedTopic.arn} />
              <input type="hidden" name="redirect_topic" value={selectedTopic.arn} />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                メールは承認済みのサブスクリプションにだけ届きます。SQS へは SNS が自動で配信します。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <input name="subject" placeholder="件名（オプション）" defaultValue="テスト通知" />
                <textarea name="message" placeholder="メッセージ本文" rows={4} defaultValue="SNSトピックからの配信テストです。" required />
                {isFifo && (
                  <>
                    <input name="message_group_id" placeholder="メッセージグループ ID（FIFO では必須）" required />
                    <input name="message_deduplication_id"
                      placeholder={selectedTopic.content_based_deduplication ? 'メッセージ重複排除 ID（オプション・コンテンツベース重複排除が有効）' : 'メッセージ重複排除 ID（コンテンツベース重複排除が無効なので必須）'}
                      required={!selectedTopic.content_based_deduplication} />
                  </>
                )}
              </div>
            </DeliveryModeForm>
          </article>
        </>
      )}

      {/* SMTP 設定（確認メール・通知メールを実際に送る場合） */}
      <SmtpSettingsCard returnTo={here} />
    </div>
  );
}
