// SMTP 設定カード（サーバーコンポーネント）
// Mailbox / Pipeline の両ページで使う。設定はバックエンドで 1 つだけ保存され、両ページ共通。
// ※ サーバーコンポーネントなのでイベントハンドラ（onClick 等）は使わず、<form> と <details> だけで構成する。

interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from: string;
  is_enabled: boolean;
  has_password?: boolean;
}

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const res = await fetch(`${BACKEND}/api/smtp/config`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

const PRESETS: { name: string; host: string; port: string; auth: string; note: string }[] = [
  { name: 'Mailpit（ローカル確認用）', host: 'mailpit', port: '1025', auth: '不要', note: '実際には外部へ送られず、http://localhost:8025 で受信内容を確認できます' },
  { name: 'Gmail', host: 'smtp.gmail.com', port: '587', auth: 'Gmail アドレス ＋ アプリ パスワード', note: '2段階認証を有効にし、Google アカウントの「アプリ パスワード」で発行した 16 桁を使います' },
  { name: 'Amazon SES', host: 'email-smtp.<リージョン>.amazonaws.com', port: '587', auth: 'SES の SMTP 認証情報', note: 'IAM のアクセスキーではなく SES コンソールで作る SMTP 認証情報。送信元アドレスの検証が必要です' },
  { name: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: '587', auth: 'メールアドレス ＋ パスワード', note: 'テナントで SMTP AUTH が無効だと失敗します（管理者設定）' },
  { name: 'SendGrid', host: 'smtp.sendgrid.net', port: '587', auth: 'ユーザー名 apikey ＋ API キー', note: '送信元アドレス（Sender Identity）の認証が必要です' },
];

const label: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' };
const code: React.CSSProperties = { backgroundColor: 'var(--code-bg)', padding: '1px 6px', borderRadius: '4px', color: '#38bdf8', fontSize: '12px' };

export default async function SmtpSettingsCard({ returnTo }: { returnTo: '/mailbox' | '/pipeline' }) {
  const cfg = await getSmtpConfig();
  const active = !!(cfg?.is_enabled && cfg?.smtp_host);
  const isPipeline = returnTo === '/pipeline';

  return (
    <article className="card" id="smtp">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#fff' }}>⚙️ SMTP 設定（実メール送信）</h2>
        <span style={{
          padding: '4px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
          backgroundColor: active ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
          color: active ? '#34d399' : 'var(--text-muted)',
        }}>
          {cfg === null ? '⚠️ 設定を取得できません' : active ? `🌐 実送信 ON（${cfg.smtp_host}:${cfg.smtp_port}）` : '🧪 擬似送信モード（設定不要）'}
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        {isPipeline
          ? 'ブロードキャスト配信時、SNS トピックのメールサブスクライバー宛てのメールをこの SMTP サーバーから実際に送信します。'
          : 'テストメール送信・SQS のメールタスク・SNS 配信で送るメールを、この SMTP サーバーから実際に送信します。'}
        {' '}設定は Mailbox / Pipeline で共通です。
      </p>
      {!active && cfg !== null && (
        <div className="alert-message alert-success" style={{ fontSize: '13px' }}>
          🧪 SMTP は未設定です。送信フォームで「<b>擬似送信</b>」を選べば、設定なしで送信・配信できます
          （外部には送らず、送信済みとして Mailbox に記録）。「SMTP で送信」を使いたいときだけ下の設定を行ってください。
        </div>
      )}

      <form method="POST" action="/api/smtp/test" style={{ marginBottom: '12px' }}>
        <input type="hidden" name="return_to" value={returnTo} />
        <button type="submit" className="btn-secondary">
          🔌 接続テスト{active ? '（送信はしません）' : '（擬似送信モード・設定不要）'}
        </button>
      </form>

      <details>
        <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
          {active ? '設定を変更する' : '実際にメールを送る場合の SMTP 設定（任意）'}
        </summary>
        <form method="POST" action="/api/smtp/config">
          <input type="hidden" name="return_to" value={returnTo} />
          <div className="grid-2" style={{ gap: '12px', marginBottom: '12px' }}>
            <div style={field}>
              <label style={label} htmlFor={`smtp_host${returnTo}`}>SMTP ホスト</label>
              <input id={`smtp_host${returnTo}`} name="smtp_host" placeholder="smtp.gmail.com" defaultValue={cfg?.smtp_host || ''} />
            </div>
            <div style={field}>
              <label style={label} htmlFor={`smtp_port${returnTo}`}>ポート（587=STARTTLS / 465=SSL / 1025・25=平文）</label>
              <input id={`smtp_port${returnTo}`} name="smtp_port" type="number" min={1} max={65535} defaultValue={cfg?.smtp_port || 587} />
            </div>
            <div style={field}>
              <label style={label} htmlFor={`smtp_user${returnTo}`}>ユーザー名（認証不要なら空欄）</label>
              <input id={`smtp_user${returnTo}`} name="smtp_user" autoComplete="off" placeholder="you@example.com" defaultValue={cfg?.smtp_user || ''} />
            </div>
            <div style={field}>
              <label style={label} htmlFor={`smtp_password${returnTo}`}>
                パスワード {cfg?.has_password ? '（保存済み・変更時のみ入力）' : ''}
              </label>
              <input id={`smtp_password${returnTo}`} name="smtp_password" type="password" autoComplete="new-password"
                placeholder={cfg?.has_password ? '●●●●●●●●（空欄なら変更しない）' : 'アプリ パスワード等'} />
            </div>
            <div style={field}>
              <label style={label} htmlFor={`smtp_from${returnTo}`}>送信元アドレス（From）</label>
              <input id={`smtp_from${returnTo}`} name="smtp_from" placeholder="aws-emulator@local.test" defaultValue={cfg?.smtp_from || 'aws-emulator@local.test'} />
            </div>
            <div style={{ ...field, justifyContent: 'flex-end', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" name="is_enabled" defaultChecked={cfg ? cfg.is_enabled : false} style={{ flex: 'none', width: '16px', height: '16px' }} />
                実メール送信を有効にする
              </label>
              {cfg?.has_password && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" name="clear_password" style={{ flex: 'none', width: '14px', height: '14px' }} />
                  保存済みパスワードを削除する
                </label>
              )}
            </div>
          </div>
          <button type="submit" className="btn-primary">💾 保存</button>
        </form>

      </details>

      <details style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#fff' }}>📖 設定方法</summary>
        <div style={{ fontSize: '13px', lineHeight: 1.8, marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ol style={{ paddingLeft: '20px' }}>
            <li>ローカルで動作確認するだけなら<b>設定は不要</b>です（擬似送信モード）。以下は実際にメールを届けたい場合の手順です。</li>
            <li>下の表から使うサービスを選び、<b>SMTP ホスト・ポート・ユーザー名・パスワード</b>を入力します。</li>
            <li><b>送信元アドレス</b>には、そのサービスで送信が許可されたアドレスを入れます（Gmail なら自分の Gmail アドレス）。</li>
            <li>「実メール送信を有効にする」にチェックを入れて <b>保存</b>。</li>
            <li><b>接続テスト</b>で接続と認証が通るか確認します（メールは送られません）。</li>
            {isPipeline ? (
              <li>パイプライン一覧で「➕ メールアドレスを追加」→ 上の <b>ブロードキャスト配信</b> を実行。配信結果は Mailbox の一覧でも確認できます。</li>
            ) : (
              <li>上の <b>テストメール送信</b> で自分宛てに送り、一覧の配信ステータスが <code style={code}>delivered_smtp</code> になれば成功です。</li>
            )}
          </ol>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr><th style={th}>サービス</th><th style={th}>ホスト</th><th style={th}>ポート</th><th style={th}>認証</th><th style={th}>注意</th></tr>
              </thead>
              <tbody>
                {PRESETS.map(p => (
                  <tr key={p.name}>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: '#fff' }}>{p.name}</td>
                    <td style={td}><code style={code}>{p.host}</code></td>
                    <td style={td}><code style={code}>{p.port}</code></td>
                    <td style={td}>{p.auth}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <b>Docker 環境での注意</b>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
              <li>SMTP 接続は <code style={code}>python</code> コンテナから行われます。ホスト PC 上で動く SMTP サーバーを指すときは <code style={code}>localhost</code> ではなく <code style={code}>host.docker.internal</code> を使ってください。</li>
              <li>Mailpit を使う場合は README の手順で <code style={code}>docker-compose.yml</code> に mailpit サービスを追加し、ホスト <code style={code}>mailpit</code>・ポート <code style={code}>1025</code>・認証なしで設定します。</li>
              <li>画面で保存した設定はコンテナ内だけに保存され、<code style={code}>docker compose down</code> などでコンテナを削除すると消えます。毎回同じ SMTP を使う場合は <code style={code}>.env</code> の <code style={code}>SMTP_*</code> に書いてください（画面で保存した設定があればそちらが優先）。</li>
            </ul>
          </div>

          <div>
            <b>うまくいかないとき</b>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
              <li><code style={code}>535 Authentication failed</code>：ユーザー名・パスワードの誤り。Gmail は通常のパスワードでは不可（アプリ パスワードが必要）。</li>
              <li><code style={code}>timed out</code> / <code style={code}>Connection refused</code>：ホスト名・ポートの誤り、またはネットワークで 587/465 が塞がれています。</li>
              <li><code style={code}>wrong version number</code>：465 と 587 の取り違え（465 は SSL、587 は STARTTLS）。</li>
              <li>送信は成功するのに届かない：迷惑メールフォルダを確認。送信元アドレスがサービス側で許可されているかも確認してください。</li>
            </ul>
          </div>
        </div>
      </details>
    </article>
  );
}
