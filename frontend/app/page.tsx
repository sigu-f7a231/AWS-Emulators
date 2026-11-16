import Link from 'next/link';

const SERVICES = [
  {
    href: '/dynamodb',
    icon: '🗄️',
    title: 'DynamoDB',
    desc: 'テーブル作成・アイテム管理・インデックス設定',
    color: '#4f46e5',
  },
  {
    href: '/s3',
    icon: '🪣',
    title: 'S3',
    desc: 'バケット管理・オブジェクト一覧・ファイル内容確認',
    color: '#0891b2',
  },
  {
    href: '/sns',
    icon: '📣',
    title: 'SNS',
    desc: 'トピック管理・サブスクリプション・メール配信',
    color: '#059669',
  },
  {
    href: '/sqs',
    icon: '📬',
    title: 'SQS',
    desc: 'キュー管理・メッセージ送受信',
    color: '#d97706',
  },
  {
    href: '/pipeline',
    icon: '🔗',
    title: 'SNS-SQS Pipeline',
    desc: 'SNSとSQSを組み合わせたパイプライン管理',
    color: '#7c3aed',
  },
  {
    href: '/mailbox',
    icon: '📧',
    title: 'Mailbox',
    desc: '送信済みメール一覧・SMTP設定',
    color: '#be185d',
  },
];

async function getHealth() {
  try {
    const res = await fetch('http://python:8000/api/health', { cache: 'no-store' });
    if (res.ok) return 'connected';
  } catch {}
  return 'disconnected';
}

export default async function HomePage() {
  const health = await getHealth();

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        padding: '20px 24px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>
            AWS Emulator Console
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            ローカル AWS エミュレーター管理画面
          </p>
        </div>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '9999px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: health === 'connected' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: health === 'connected' ? '#34d399' : '#f87171',
          border: health === 'connected' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: health === 'connected' ? '#34d399' : '#f87171',
          }} />
          {health === 'connected' ? 'エミュレーター接続中' : 'エミュレーター未接続'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        {SERVICES.map(({ href, icon, title, desc, color }) => (
          <Link
            key={href}
            href={href}
            style={{ textDecoration: 'none' }}
          >
            <article style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'border-color 0.2s, transform 0.1s',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: `${color}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px',
              }}>
                {icon}
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {title}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {desc}
                </p>
              </div>
              <span style={{
                fontSize: '13px',
                color: color,
                fontWeight: 600,
              }}>
                管理画面へ →
              </span>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
