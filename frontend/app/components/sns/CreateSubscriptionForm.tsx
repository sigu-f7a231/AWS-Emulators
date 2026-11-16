'use client';
// サブスクリプションの作成（AWS コンソールと同じ: トピック ARN / プロトコル / エンドポイント）
// ＋ 確認メールの送信方法（SMTP / 擬似送信）。SMTP 未設定で SMTP を選ぶと、その場でエラーにして作成ボタンを押せなくする。
import { useState } from 'react';

export interface TopicOption { arn: string; name: string; type?: string; }

const label: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px', display: 'block' };
const hint: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' };

export default function CreateSubscriptionForm({
  topics, defaultTopicArn, smtpReady, smtpLabel, returnTopic,
}: {
  topics: TopicOption[];
  defaultTopicArn?: string;
  smtpReady: boolean;
  smtpLabel?: string;
  returnTopic?: string;   // 作成後に戻るトピック（未指定なら作成したトピック）
}) {
  // トピックが 1 つしかない場合は自動で選択
  const initial = defaultTopicArn && topics.some(t => t.arn === defaultTopicArn)
    ? defaultTopicArn : topics.length === 1 ? topics[0].arn : '';
  const [topicArn, setTopicArn] = useState(initial);
  const [protocol, setProtocol] = useState('email');
  const [mode, setMode] = useState<'smtp' | 'local'>(smtpReady ? 'smtp' : 'local');

  const topic = topics.find(t => t.arn === topicArn);
  const fifoEmail = topic?.type === 'fifo' && protocol === 'email';
  const smtpBlocked = mode === 'smtp' && !smtpReady;
  const blocked = !topicArn || fifoEmail || smtpBlocked;

  const modeCard = (v: 'smtp' | 'local', title: string, sub: string) => (
    <label style={{
      flex: 1, minWidth: '200px', display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer',
      padding: '10px 12px', borderRadius: '8px',
      border: `1px solid ${mode === v ? 'var(--aws-orange)' : 'var(--border-color)'}`,
      backgroundColor: mode === v ? 'rgba(255,153,0,0.08)' : 'var(--bg-primary)',
    }}>
      <input type="radio" name="delivery_mode" value={v} checked={mode === v} onChange={() => setMode(v)}
        style={{ flex: 'none', width: '16px', height: '16px', marginTop: '2px' }} />
      <span>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: '#fff' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</span>
      </span>
    </label>
  );

  return (
    <form method="POST" action="/api/sns/subscribe" onSubmit={e => { if (blocked) e.preventDefault(); }}>
      {smtpBlocked && (
        <div className="alert-message alert-error" role="alert">
          ⚠️ SMTP が設定されていません（または無効です）。このままでは作成できません。
          <a href="#smtp" style={{ color: '#fff', marginLeft: '6px' }}>SMTP 設定へ</a>　または「擬似送信」を選んでください。
        </div>
      )}
      {fifoEmail && (
        <div className="alert-message alert-error" role="alert">
          ⚠️ FIFO トピックは Eメール のサブスクリプションに対応していません（AWS と同じ）。スタンダードトピックを選んでください。
        </div>
      )}

      <input type="hidden" name="topic_arn" value={topicArn} />
      <input type="hidden" name="redirect_topic" value={returnTopic || topicArn} />

      <label style={label} htmlFor="sub-topic">トピック ARN</label>
      <select id="sub-topic" value={topicArn} onChange={e => setTopicArn(e.target.value)} required style={{ width: '100%' }}>
        <option value="">── トピックを選択 ──</option>
        {topics.map(t => (
          <option key={t.arn} value={t.arn}>{t.arn}{t.type === 'fifo' ? '（FIFO）' : ''}</option>
        ))}
      </select>
      <p style={hint}>サブスクリプションを登録するトピック。{topics.length === 1 && 'トピックが 1 つだけなので自動で選択しています。'}</p>

      <label style={{ ...label, marginTop: '14px' }} htmlFor="sub-protocol">プロトコル</label>
      <select id="sub-protocol" name="protocol" value={protocol} onChange={e => setProtocol(e.target.value)} style={{ width: '100%' }}>
        <option value="email">Eメール</option>
      </select>
      <p style={hint}>サブスクライブするエンドポイントのタイプ。</p>

      <label style={{ ...label, marginTop: '14px' }} htmlFor="sub-endpoint">エンドポイント</label>
      <input id="sub-endpoint" name="email" type="email" placeholder="user@example.com" required style={{ width: '100%' }} />
      <p style={hint}>Amazon SNS からの通知を受け取るメールアドレス。作成後は「承認待ち」になり、確認メールのリンクで承認すると配信が始まります。</p>

      <span style={{ ...label, marginTop: '14px' }}>確認メールの送信方法</span>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {modeCard('smtp', '🌐 SMTP で送信', smtpReady ? `実際にメールを送ります（${smtpLabel || 'SMTP'}）` : '未設定のため使えません')}
        {modeCard('local', '🧪 擬似送信', '外部には送らず、送信済みとして Mailbox に記録します')}
      </div>

      <button type="submit" className="btn-primary" disabled={blocked}
        title={!topicArn ? 'トピックを選択してください' : undefined}>
        サブスクリプションの作成
      </button>
    </form>
  );
}
