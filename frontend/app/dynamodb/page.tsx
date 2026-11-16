// DynamoDB ページ（サーバーコンポーネント・useState なし）
interface KeyInfo { name: string; type: string; data_type: string; }
interface GsiInfo { name: string; keys: KeyInfo[]; projection: string; status: string; item_count: number; }
interface TableDetail {
  name: string; status: string; item_count: number; size_bytes: number;
  keys: KeyInfo[]; gsis: GsiInfo[]; lsis: GsiInfo[];
  billing_mode: string; rcu: number; wcu: number; arn: string; creation_date: string;
  error?: string;
}

interface DatabaseSummary {
  name: string; description?: string; table_count: number; relation_count: number;
  tables: { name: string; physical_name: string; exists: boolean | null }[];
}

async function getDatabases(): Promise<DatabaseSummary[]> {
  try {
    const res = await fetch(`${process.env.BACKEND_INTERNAL_URL || 'http://python:8000'}/api/dynamodb/databases`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function getTables(): Promise<TableDetail[]> {
  try {
    const res = await fetch('http://python:8000/api/dynamodb/tables', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function DynamoDBPage({
  searchParams,
}: {
  searchParams: { msg?: string; err?: string };
}) {
  const [tables, databases] = await Promise.all([getTables(), getDatabases()]);
  const dbNames = new Set(databases.map(d => d.name));
  const dbOf = (table: string) => {
    const i = table.indexOf('.');
    return i > 0 && dbNames.has(table.slice(0, i)) ? table.slice(0, i) : null;
  };
  // テーブルは必ず DB に属する。DB に属さない実テーブル（外部から直接作られたもの等）は表示しない
  const dbTables = tables.filter(t => dbOf(t.name));
  const msg = searchParams.msg;
  const err = searchParams.err;

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>
        🗄️ DynamoDB テーブル管理
      </h1>

      {msg && (
        <div className="alert-message alert-success">{decodeURIComponent(msg)}</div>
      )}
      {err && (
        <div className="alert-message alert-error">{decodeURIComponent(err)}</div>
      )}

      {/* ── データベース（論理 DB：テーブル名の接頭辞でグループ化） ── */}
      <article className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px', color: '#fff' }}>
          🗂️ データベース ({databases.length})
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          テーブルは必ず DB の中に作ります。DB を作成し、その中でカラム・主キー・インデックス・外部キーを定義してください。
          実テーブル名は <code style={{ color: '#38bdf8' }}>DB名.テーブル名</code> になり、アイテム保存時に型・必須・外部キーがチェックされます。
        </p>
        {databases.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {databases.map(d => (
              <a key={d.name} href={`/dynamodb/databases/${encodeURIComponent(d.name)}`} style={{
                display: 'block', padding: '12px 14px', borderRadius: '10px', textDecoration: 'none',
                backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-main)',
              }}>
                <div style={{ fontWeight: 700, color: '#fff' }}>🗂️ {d.name}</div>
                {d.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{d.description}</div>}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  テーブル {d.table_count} ・ リレーション {d.relation_count}
                </div>
                {d.tables.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px', fontFamily: 'monospace' }}>
                    {d.tables.map(t => t.name).join(', ')}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
        <form method="POST" action="/api/dynamodb/databases">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input name="name" placeholder="DB 名 (例: shop)" required pattern="[A-Za-z0-9_\-]{1,100}" title="英数字・_・- の 1〜100 文字（. は不可）" />
            <input name="description" placeholder="説明 (任意)" />
            <button type="submit" className="btn-primary">DB を作成</button>
          </div>
        </form>
      </article>

      {/* ── テーブル一覧 ── */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '20px', color: '#fff' }}>
          📋 テーブル一覧 ({dbTables.length} 件)
        </h2>
        {dbTables.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>テーブルがありません。上の「データベース」で DB を作成し、その中にテーブルを作ってください。</p>
        ) : (
          <div className="item-list">
            {dbTables.map((t) => (
              <div key={t.name} style={{
                padding: '16px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                        {t.status}
                      </span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                        {t.billing_mode}
                      </span>
                      {dbOf(t.name) && (
                        <a href={`/dynamodb/databases/${encodeURIComponent(dbOf(t.name)!)}`} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', backgroundColor: 'rgba(255,153,0,0.15)', color: '#ff9900', textDecoration: 'none' }}>
                          🗂️ DB: {dbOf(t.name)}
                        </a>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t.item_count} アイテム
                      </span>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {t.keys?.map(k => (
                        <span key={k.name} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {k.type === 'HASH' ? '🔑' : '📌'} {k.name} ({k.data_type})
                        </span>
                      ))}
                      {t.gsis?.map(g => (
                        <span key={g.name} style={{ fontSize: '12px', color: '#818cf8' }}>
                          🔍 GSI: {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <a
                      href={`/dynamodb/${encodeURIComponent(t.name)}`}
                      style={{
                        padding: '6px 14px', fontSize: '13px', borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        color: 'var(--text-main)', textDecoration: 'none',
                      }}
                    >
                      📂 アイテム管理
                    </a>
                  </div>
                </div>
                {t.error && (
                  <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>⚠️ {t.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
