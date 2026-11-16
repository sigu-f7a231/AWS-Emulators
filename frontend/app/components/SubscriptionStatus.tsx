// 購読の承認状態バッジ（サーバーコンポーネント）
// SNS 画面では、承認待ちなら「確認メールを再送」（擬似送信 / SMTP を選んで再送）も出す。
export default function SubscriptionStatus({
  status, subscriptionArn, returnTo, smtpReady, readOnly,
}: {
  status?: string;
  subscriptionArn?: string;
  returnTo?: string;
  smtpReady?: boolean;
  readOnly?: boolean;   // Pipeline 画面など: 状態の表示だけ
}) {
  const pending = status === 'pending_confirmation';
  const btn: React.CSSProperties = { padding: '2px 8px', fontSize: '11px' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <span style={{
        padding: '1px 8px', borderRadius: '99px', fontSize: '11px',
        backgroundColor: pending ? 'rgba(234,179,8,0.15)' : 'rgba(16,185,129,0.15)',
        color: pending ? '#facc15' : '#34d399',
      }}>
        {pending ? '⏳ 承認待ち' : '✅ 承認済み'}
      </span>
      {pending && !readOnly && subscriptionArn && (
        <form method="POST" action="/api/sns/resend-confirmation" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
          <input type="hidden" name="subscription_arn" value={subscriptionArn} />
          <input type="hidden" name="return_to" value={returnTo || '/sns'} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>確認メールを再送:</span>
          <button type="submit" name="delivery_mode" value="local" className="btn-secondary" style={btn}>🧪 擬似送信</button>
          <button type="submit" name="delivery_mode" value="smtp" className="btn-secondary" style={btn}
            disabled={!smtpReady} title={smtpReady ? undefined : 'SMTP が設定されていません（または無効です）'}>🌐 SMTP</button>
        </form>
      )}
    </span>
  );
}
