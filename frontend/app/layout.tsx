import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AWS Emulator Console',
  description: 'Local AWS Emulator Web Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          padding: '0 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          height: '56px',
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #ff9900, #ff5722)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '14px',
            padding: '4px 10px',
            borderRadius: '6px',
            marginRight: '20px',
            letterSpacing: '0.5px',
          }}>
            AWS EMU
          </span>
          {[
            { href: '/', label: '🏠 ホーム' },
            { href: '/dynamodb', label: '🗄️ DynamoDB' },
            { href: '/s3', label: '🪣 S3' },
            { href: '/sns', label: '📣 SNS' },
            { href: '/sqs', label: '📬 SQS' },
            { href: '/pipeline', label: '🔗 Pipeline' },
            { href: '/mailbox', label: '📧 Mailbox' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="nav-link"
            >
              {label}
            </a>
          ))}
        </nav>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
