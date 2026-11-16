// DynamoDB ページ（AWS の DynamoDB と同じ仕様：テーブル ＋ キー / インデックス、アイテムはスキーマレス）
import ConfirmSubmitButton from '../components/ConfirmSubmitButton';
import CreateTableForm from '../components/dynamodb/CreateTableForm';

interface KeyInfo { name: string; type: string; data_type: string; }
interface IndexInfo { name: string; keys: KeyInfo[]; projection: string; non_key_attributes?: string[]; status?: string; item_count?: number; }
interface TableDetail {
  name: string; status: string; item_count: number; size_bytes: number;
  keys: KeyInfo[]; gsis: IndexInfo[]; lsis: IndexInfo[];
  billing_mode: string; rcu: number; wcu: number; arn: string; creation_date: string;
  error?: string;
}

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getTables(): Promise<{ tables: TableDetail[]; error?: string }> {
  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/tables`, { cache: 'no-store' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { tables: [], error: typeof d.detail === 'string' ? d.detail : 'テーブル一覧を取得できません' };
    }
    return { tables: await res.json() };
  } catch (e: any) { return { tables: [], error: e.message }; }
}

const chip = (bg: string, color: string): React.CSSProperties => ({
  fontSize: '11px', padding: '2px 8px', borderRadius: '99px', backgroundColor: bg, color, whiteSpace: 'nowrap',
});
const keyText = (keys: KeyInfo[]) =>
  keys.map(k => `${k.name} (${k.data_type}${k.type === 'HASH' ? ', PK' : ', SK'})`).join(' + ');

export default async function DynamoDBPage({
  searchParams,
}: {
  searchParams: { msg?: string; err?: string };
}) {
  const { tables, error } = await getTables();

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>🗄️ DynamoDB</h1>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}
      {error && <div className="alert-message alert-error">{error}</div>}

      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>➕ テーブルを作成</h2>
        <CreateTableForm />
      </article>

      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '20px', color: '#fff' }}>📋 テーブル ({tables.length})</h2>
        {tables.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>テーブルがありません。</p>
        ) : (
          <div className="item-list">
            {tables.map((t) => (
              <div key={t.name} style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={chip('rgba(16,185,129,0.15)', '#34d399')}>{t.status}</span>
                      <span style={chip('rgba(99,102,241,0.15)', '#a5b4fc')}>
                        {t.billing_mode}{t.billing_mode === 'PROVISIONED' ? ` (R ${t.rcu} / W ${t.wcu})` : ''}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.item_count ?? 0} アイテム</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span>🔑 主キー: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{keyText(t.keys || [])}</span></span>
                      {t.gsis?.map(g => (
                        <span key={g.name}>🔍 GSI <b style={{ color: '#34d399' }}>{g.name}</b>: <span style={{ fontFamily: 'monospace' }}>{keyText(g.keys)}</span> ／ {g.projection}{g.non_key_attributes?.length ? ` [${g.non_key_attributes.join(', ')}]` : ''}</span>
                      ))}
                      {t.lsis?.map(l => (
                        <span key={l.name}>🔍 LSI <b style={{ color: '#38bdf8' }}>{l.name}</b>: <span style={{ fontFamily: 'monospace' }}>{keyText(l.keys)}</span> ／ {l.projection}{l.non_key_attributes?.length ? ` [${l.non_key_attributes.join(', ')}]` : ''}</span>
                      ))}
                    </div>
                    {t.error && <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>⚠️ {t.error}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                    <a href={`/dynamodb/${encodeURIComponent(t.name)}`} style={{
                      padding: '6px 14px', fontSize: '13px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)', color: 'var(--text-main)', textDecoration: 'none',
                    }}>📂 アイテム</a>
                    <form method="POST" action="/api/dynamodb/delete-table">
                      <input type="hidden" name="table_name" value={t.name} />
                      <ConfirmSubmitButton
                        message={`テーブル「${t.name}」を削除します。アイテムもすべて消えます。よろしいですか？`}
                        style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                      >🗑️ 削除</ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
