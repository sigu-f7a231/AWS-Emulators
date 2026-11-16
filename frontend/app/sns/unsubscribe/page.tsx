// SNS 配信停止ページ（通知メールの配信停止リンク先）
export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { SubscriptionArn?: string; Token?: string; done?: string; err?: string };
}) {
  const arn = searchParams.SubscriptionArn || '';
  const token = searchParams.Token || '';

  return (
    <article className="card" style={{ maxWidth: '640px', margin: '40px auto' }}>
      {searchParams.done ? (
        <>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#34d399', marginBottom: '12px' }}>✅ Subscription removed!</h1>
          <p>配信を停止しました。このトピックからのメールは今後届きません。</p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>📭 配信を停止しますか？</h1>
          {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', wordBreak: 'break-all' }}>
            Subscription ID: <code style={{ color: '#38bdf8' }}>{arn || '（なし）'}</code>
          </p>
          <form method="POST" action="/api/sns/unsubscribe">
            <input type="hidden" name="subscription_arn" value={arn} />
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn-primary" disabled={!arn || !token}>配信を停止する</button>
          </form>
        </>
      )}
      <p style={{ marginTop: '20px' }}><a href="/pipeline" style={{ color: 'var(--aws-orange)' }}>← Pipeline へ</a></p>
    </article>
  );
}
