// DynamoDB DB 詳細ページ（サーバーコンポーネント）
// テーブル定義（カラム / 主キー / インデックス / 外部キー）とリレーション、テーブル作成ビルダー
import ConfirmSubmitButton from '../../../components/ConfirmSubmitButton';
import TableBuilder, { ExistingTable } from '../../../components/dynamodb/TableBuilder';

interface Column { name: string; type: string; required: boolean; description?: string; }
interface Index { name: string; type: 'GSI' | 'LSI'; partition_key: string; sort_key?: string | null; projection_type: string; }
interface ForeignKey { name: string; columns: string[]; ref_table: string; ref_columns: string[]; }
interface SchemaTable {
  name: string; physical_name: string; description?: string;
  columns: Column[]; primary_key: { partition_key: string; sort_key?: string | null };
  indexes: Index[]; foreign_keys: ForeignKey[]; billing_mode: string;
  exists: boolean | null; referenced_by: { table: string; columns: string[]; name: string }[];
}
interface Relation { name: string; from_table: string; columns: string[]; to_table: string; ref_columns: string[]; }
interface DatabaseDetail { name: string; description?: string; created_at?: string; tables: SchemaTable[]; relations: Relation[]; }

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getDatabase(name: string): Promise<{ db: DatabaseDetail | null; error?: string }> {
  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/databases/${encodeURIComponent(name)}`, { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { db: null, error: typeof d.detail === 'string' ? d.detail : 'DB を取得できません' };
    return { db: d };
  } catch (e: any) { return { db: null, error: e.message }; }
}

const chip = (bg: string, color: string): React.CSSProperties => ({
  fontSize: '11px', padding: '1px 7px', borderRadius: '99px', backgroundColor: bg, color, whiteSpace: 'nowrap',
});
const TYPE_COLOR: Record<string, string> = { S: '#38bdf8', N: '#fb923c', B: '#94a3b8', BOOL: '#a78bfa', L: '#34d399', M: '#f472b6' };

export default async function DatabasePage({
  params, searchParams,
}: {
  params: { db: string };
  searchParams: { msg?: string; err?: string };
}) {
  const dbName = decodeURIComponent(params.db);
  const { db, error } = await getDatabase(dbName);

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
      <a href="/dynamodb" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>← DynamoDB</a>
      <span style={{ color: 'var(--border-color)' }}>/</span>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>🗂️ DB: {dbName}</h1>
    </div>
  );

  if (!db) {
    return (
      <div>
        {header}
        <div className="alert-message alert-error">{error}</div>
      </div>
    );
  }

  const existingTables: ExistingTable[] = db.tables.map(t => ({ name: t.name, columns: t.columns, primary_key: t.primary_key }));

  return (
    <div>
      {header}
      {db.description && <p style={{ color: 'var(--text-muted)', marginTop: '-16px', marginBottom: '20px' }}>{db.description}</p>}

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      {/* テーブル定義 */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
          📐 テーブル定義 ({db.tables.length})
        </h2>
        {db.tables.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>テーブルがありません。下のフォームから作成してください。</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {db.tables.map(t => {
              const fkCols = new Map<string, string>();
              t.foreign_keys.forEach(fk => fk.columns.forEach((c, i) => fkCols.set(c, `${fk.ref_table}.${fk.ref_columns[i]}`)));
              const idxCols = new Map<string, string[]>();
              t.indexes.forEach(ix => [ix.partition_key, ix.sort_key].filter(Boolean).forEach(c => {
                idxCols.set(c as string, [...(idxCols.get(c as string) || []), ix.name]);
              }));
              return (
                <div key={t.name} id={`t-${t.name}`} style={{
                  border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,153,0,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>{t.name}</span>
                      <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.physical_name}</code>
                    </div>
                    {t.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.description}</div>}
                    {t.exists === false && (
                      <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>⚠️ 実テーブルがありません（エミュレータのデータが消えた可能性）</div>
                    )}
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <tbody>
                      {t.columns.map(c => {
                        const isPk = c.name === t.primary_key.partition_key;
                        const isSk = c.name === t.primary_key.sort_key;
                        return (
                          <tr key={c.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '5px 14px', width: '24px' }}>{isPk ? '🔑' : isSk ? '📌' : fkCols.has(c.name) ? '🔗' : ''}</td>
                            <td style={{ padding: '5px 4px', color: '#fff', fontFamily: 'monospace' }} title={c.description || ''}>
                              {c.name}{c.required && !isPk && !isSk ? <span style={{ color: '#f87171' }}> *</span> : ''}
                            </td>
                            <td style={{ padding: '5px 4px', color: TYPE_COLOR[c.type] || '#94a3b8', fontFamily: 'monospace' }}>{c.type}</td>
                            <td style={{ padding: '5px 14px 5px 4px', textAlign: 'right' }}>
                              <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {isPk && <span style={chip('rgba(255,153,0,0.15)', '#ff9900')}>PK</span>}
                                {isSk && <span style={chip('rgba(255,153,0,0.1)', '#fdba74')}>SK</span>}
                                {fkCols.has(c.name) && (
                                  <a href={`#t-${fkCols.get(c.name)!.split('.')[0]}`} style={{ ...chip('rgba(56,189,248,0.12)', '#38bdf8'), textDecoration: 'none' }}>
                                    → {fkCols.get(c.name)}
                                  </a>
                                )}
                                {idxCols.get(c.name)?.map(n => <span key={n} style={chip('rgba(16,185,129,0.12)', '#34d399')}>🔍 {n}</span>)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ padding: '10px 14px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {t.indexes.map(ix => (
                      <div key={ix.name} style={{ color: 'var(--text-muted)' }}>
                        🔍 <b style={{ color: '#34d399' }}>{ix.type}</b> {ix.name}: {ix.partition_key}{ix.sort_key ? ` + ${ix.sort_key}` : ''} ({ix.projection_type})
                      </div>
                    ))}
                    {t.referenced_by.length > 0 && (
                      <div style={{ color: 'var(--text-muted)' }}>
                        ⬅️ 参照元: {t.referenced_by.map(r => `${r.table}(${r.columns.join('+')})`).join(', ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                      <a href={`/dynamodb/${encodeURIComponent(t.physical_name)}`} style={{
                        padding: '5px 12px', fontSize: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)', color: 'var(--text-main)', textDecoration: 'none',
                      }}>📂 アイテム管理</a>
                      <form method="POST" action={`/api/dynamodb/databases/${encodeURIComponent(db.name)}/tables/${encodeURIComponent(t.name)}/delete`}>
                        <ConfirmSubmitButton
                          message={`テーブル「${t.physical_name}」を削除します。アイテムもすべて消えます。よろしいですか？`}
                          style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                        >🗑️ 削除</ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
          🔑 パーティションキー　📌 ソートキー　🔗 外部キー　🔍 インデックス　<span style={{ color: '#f87171' }}>*</span> 必須
        </p>
      </article>

      {/* リレーション */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '12px', color: '#fff' }}>🔗 リレーション ({db.relations.length})</h2>
        {db.relations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>外部キーはまだありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {db.relations.map(r => (
              <div key={`${r.from_table}-${r.name}`} style={{ fontFamily: 'monospace', fontSize: '13px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={`#t-${r.from_table}`} style={{ color: '#fff' }}>{r.from_table}</a>
                <span style={{ color: 'var(--text-muted)' }}>({r.columns.join(', ')})</span>
                <span style={{ color: 'var(--aws-orange)' }}>──▶</span>
                <a href={`#t-${r.to_table}`} style={{ color: '#fff' }}>{r.to_table}</a>
                <span style={{ color: 'var(--text-muted)' }}>({r.ref_columns.join(', ')})</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* テーブル作成 */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>➕ テーブルを作成</h2>
        <TableBuilder dbName={db.name} existingTables={existingTables} />
      </article>

      {/* DB 削除 */}
      <article className="card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#f87171' }}>⚠️ DB を削除</h2>
        <form method="POST" action={`/api/dynamodb/databases/${encodeURIComponent(db.name)}/delete`} style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input type="checkbox" name="cascade" style={{ flex: 'none', width: '16px', height: '16px' }} />
            DB 内のテーブル（{db.tables.length} 個）とアイテムもすべて削除する
          </label>
          <ConfirmSubmitButton message={`DB「${db.name}」を削除します。よろしいですか？`} className="btn-secondary">
            🗑️ DB を削除
          </ConfirmSubmitButton>
        </form>
      </article>
    </div>
  );
}
