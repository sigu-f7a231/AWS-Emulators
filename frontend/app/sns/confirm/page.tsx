// SNS 購読の承認ページ（確認メールのリンク先）。AWS と同じく、リンクを開くと承認される。
const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function confirm(token: string, topicArn: string) {
  try {
    const res = await fetch(`${BACKEND}/api/sns/confirm-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, topic_arn: topicArn || null }),
      cache: 'no-store',
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true as const, data: d } : { ok: false as const, error: typeof d.detail === 'string' ? d.detail : '承認できませんでした' };
  } catch (e: any) {
    return { ok: false as const, error: e.message || 'バックエンドに接続できません' };
  }
}

export default async function ConfirmSubscriptionPage({
  searchParams,
}: {
  searchParams: { Token?: string; TopicArn?: string };
}) {
  const token = searchParams.Token || '';
  const result = token ? await confirm(token, searchParams.TopicArn || '') : { ok: false as const, error: 'リンクにトークンがありません' };

  return (
    <article className="card" style={{ maxWidth: '640px', margin: '40px auto' }}>
      {result.ok ? (
        <>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#34d399', marginBottom: '12px' }}>✅ Subscription confirmed!</h1>
          <p style={{ marginBottom: '12px' }}>購読を承認しました。これからこのトピックのメッセージが届きます。</p>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>宛先: <code style={{ color: '#38bdf8' }}>{result.data.endpoint}</code></span>
            <span>トピック: <code style={{ color: '#38bdf8' }}>{result.data.topic_arn}</code></span>
            <span>Subscription ID: <code style={{ color: '#38bdf8', wordBreak: 'break-all' }}>{result.data.subscription_arn}</code></span>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f87171', marginBottom: '12px' }}>⚠️ 承認できませんでした</h1>
          <p>{result.error}</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
            Pipeline / SNS 画面の購読一覧から「確認メールを再送」できます。
          </p>
        </>
      )}
      <p style={{ marginTop: '20px' }}><a href="/pipeline" style={{ color: 'var(--aws-orange)' }}>← Pipeline へ</a></p>
    </article>
  );
}
