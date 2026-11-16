// DynamoDB テーブル詳細ページ（アイテム一覧 + 追加・編集）
import ConfirmSubmitButton from '../../components/ConfirmSubmitButton';
interface AttrValue { type: string; value: unknown; }
interface ItemRecord { _raw: Record<string, Record<string, unknown>>; attributes: Record<string, AttrValue>; }
interface TableDetail {
  name: string; status: string; item_count: number;
  keys: { name: string; type: string; data_type: string }[];
  gsis: { name: string; keys: { name: string; type: string; data_type: string }[]; projection: string }[];
  lsis: { name: string; keys: { name: string; type: string; data_type: string }[]; projection: string }[];
  billing_mode: string;
}

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// DB/テーブル設計で作ったテーブルなら定義（カラム・外部キー）を取得。管理外なら null
interface TableSchema {
  database: string; name: string; physical_name: string; description?: string;
  columns: { name: string; type: string; required: boolean; description?: string }[];
  primary_key: { partition_key: string; sort_key?: string | null };
  foreign_keys: { name: string; columns: string[]; ref_table: string; ref_columns: string[]; ref_physical_name?: string | null }[];
  referenced_by: { table: string; columns: string[] }[];
}

async function getTableSchema(tableName: string): Promise<TableSchema | null> {
  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/table-schema?table=${encodeURIComponent(tableName)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getTableDetail(tableName: string): Promise<TableDetail | null> {
  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/tables`, { cache: 'no-store' });
    if (!res.ok) return null;
    const tables: TableDetail[] = await res.json();
    return tables.find(t => t.name === tableName) || null;
  } catch { return null; }
}

async function getItems(tableName: string): Promise<ItemRecord[]> {
  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/items?table=${encodeURIComponent(tableName)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

const TYPE_LABELS: Record<string, string> = {
  S: '文字列', N: '数値', BOOL: 'Boolean', L: 'リスト', M: 'Map', NULL: 'Null', B: 'バイナリ',
};
const TYPE_COLOR: Record<string, string> = {
  S: '#38bdf8', N: '#fb923c', BOOL: '#a78bfa', L: '#34d399', M: '#f472b6', NULL: '#94a3b8',
};

export default async function TableDetailPage({
  params,
  searchParams,
}: {
  params: { table: string };
  searchParams: { msg?: string; err?: string };
}) {
  const tableName = decodeURIComponent(params.table);
  const [tableDetail, items, schema] = await Promise.all([
    getTableDetail(tableName),
    getItems(tableName),
    getTableSchema(tableName),
  ]);

  const pkAttr = tableDetail?.keys?.find(k => k.type === 'HASH');
  const skAttr = tableDetail?.keys?.find(k => k.type === 'RANGE');

  // Build initial attributes for new-item form from key schema
  // スキーマ定義があれば全カラムを、無ければキーだけを初期行にする
  const fkOf = new Map<string, { ref: string; physical?: string | null }>();
  schema?.foreign_keys.forEach(fk => fk.columns.forEach((c, i) => fkOf.set(c, { ref: `${fk.ref_table}.${fk.ref_columns[i]}`, physical: fk.ref_physical_name })));
  const initAttrs: { name: string; type: string; required?: boolean; hint?: string }[] = schema
    ? schema.columns.map(c => ({
        name: c.name,
        type: ['S', 'N', 'BOOL', 'L', 'M'].includes(c.type) ? c.type : 'S',
        required: c.required,
        hint: fkOf.has(c.name) ? `→ ${fkOf.get(c.name)!.ref} に存在する値` : c.description || '',
      }))
    : tableDetail?.keys?.map(k => ({ name: k.name, type: k.data_type, required: true, hint: '' })) || [{ name: 'id', type: 'S', required: true, hint: '' }];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <a href="/dynamodb" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>
          ← DynamoDB
        </a>
        <span style={{ color: 'var(--border-color)' }}>/</span>
        {schema && <>
          <a href={`/dynamodb/databases/${encodeURIComponent(schema.database)}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>
            🗂️ {schema.database}
          </a>
          <span style={{ color: 'var(--border-color)' }}>/</span>
        </>}
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>
          🗄️ {tableName}
        </h1>
        {tableDetail && (
          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '99px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
            {tableDetail.status}
          </span>
        )}
      </div>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      {/* テーブル詳細 */}
      {tableDetail && (
        <article className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>テーブル情報</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '12px' }}>
            {[
              { label: 'アイテム数', value: tableDetail.item_count },
              { label: '課金モード', value: tableDetail.billing_mode },
              { label: 'GSI 数', value: tableDetail.gsis?.length || 0 },
              { label: 'LSI 数', value: tableDetail.lsis?.length || 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {tableDetail.keys?.map(k => (
              <span key={k.name} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                {k.type === 'HASH' ? '🔑 PK' : '📌 SK'} {k.name} ({k.data_type})
              </span>
            ))}
            {tableDetail.gsis?.map(g => (
              <span key={g.name} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                🔍 GSI: {g.name} ({g.projection})
              </span>
            ))}
          </div>
        </article>
      )}

      {!schema && (
        <div className="alert-message alert-error">
          このテーブルはどの DB にも属していないため、アイテムを保存できません。テーブルは <a href="/dynamodb" style={{ color: '#fff' }}>DB の中に作成</a> してください。
        </div>
      )}

      {/* テーブル設計（カラム定義・外部キー） */}
      {schema && (
        <article className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
            📐 カラム定義 <span style={{ fontSize: '12px', fontWeight: 400 }}>（保存時に型・必須・外部キーをチェック）</span>
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {schema.columns.map(c => (
              <span key={c.name} title={c.description || ''} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', fontFamily: 'monospace' }}>
                {c.name === schema.primary_key.partition_key ? '🔑 ' : c.name === schema.primary_key.sort_key ? '📌 ' : fkOf.has(c.name) ? '🔗 ' : ''}
                <span style={{ color: '#fff' }}>{c.name}</span>
                <span style={{ color: 'var(--text-muted)' }}> {c.type}</span>
                {c.required && <span style={{ color: '#f87171' }}> *</span>}
                {fkOf.has(c.name) && (
                  fkOf.get(c.name)!.physical
                    ? <a href={`/dynamodb/${encodeURIComponent(fkOf.get(c.name)!.physical!)}`} style={{ color: '#38bdf8', marginLeft: '6px' }}>→ {fkOf.get(c.name)!.ref}</a>
                    : <span style={{ color: '#38bdf8', marginLeft: '6px' }}>→ {fkOf.get(c.name)!.ref}</span>
                )}
              </span>
            ))}
          </div>
          {schema.referenced_by.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              ⬅️ このテーブルを参照: {schema.referenced_by.map(r => `${r.table}(${r.columns.join('+')})`).join(', ')}（参照されている間はテーブルを削除できません）
            </p>
          )}
        </article>
      )}

      {/* アイテム追加フォーム */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '20px', color: '#fff' }}>➕ アイテムを追加・上書き</h2>
        <form method="POST" action={`/api/dynamodb/put-item`}>
          <input type="hidden" name="table_name" value={tableName} />
          <div id="attr-fields" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {initAttrs.map((attr, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 100px 1fr', gap: '8px' }}>
                <input name="attr_name" defaultValue={attr.name} placeholder="属性名" required={attr.required} />
                <select name="attr_type" defaultValue={attr.type}>
                  {['S', 'N', 'BOOL', 'L', 'M', 'NULL'].map(t => (
                    <option key={t} value={t}>{t} - {TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <input name="attr_value" placeholder={`${attr.required ? '値（必須）' : '値（空欄なら保存しない）'}${attr.hint ? ` ${attr.hint}` : ''}`} required={attr.required} />
              </div>
            ))}
            {/* 追加属性用の空行 */}
            {[1, 2, 3].map(i => (
              <div key={`extra-${i}`} style={{ display: 'grid', gridTemplateColumns: '180px 100px 1fr', gap: '8px' }}>
                <input name="attr_name" placeholder={`属性名 ${i + initAttrs.length}`} />
                <select name="attr_type">
                  {['S', 'N', 'BOOL', 'L', 'M', 'NULL'].map(t => (
                    <option key={t} value={t}>{t} - {TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <input name="attr_value" placeholder="値" />
              </div>
            ))}
          </div>
          <button type="submit" className="btn-primary">💾 アイテムを保存</button>
        </form>
      </article>

      {/* アイテム一覧 */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
          📋 アイテム一覧 ({items.length} 件)
        </h2>
        {items.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>アイテムがありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{
                padding: '14px 16px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {Object.entries(item.attributes).map(([k, v]) => (
                    <span key={k} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: '4px', fontSize: '11px',
                        backgroundColor: `${TYPE_COLOR[v.type] || '#94a3b8'}22`,
                        color: TYPE_COLOR[v.type] || '#94a3b8',
                        fontFamily: 'monospace',
                      }}>{v.type}</span>
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {String(v.value).substring(0, 60)}{String(v.value).length > 60 ? '…' : ''}
                      </span>
                    </span>
                  ))}
                </div>
                {/* 削除フォーム */}
                {pkAttr && (
                  <form
                    method="POST"
                    action="/api/dynamodb/delete-item"
                    style={{ display: 'inline', marginTop: '8px' }}
                  >
                    <input type="hidden" name="table_name" value={tableName} />
                    <input type="hidden" name="pk_name" value={pkAttr.name} />
                    <input type="hidden" name="pk_type" value={pkAttr.data_type} />
                    <input type="hidden" name="pk_value" value={String(item.attributes[pkAttr.name]?.value || '')} />
                    {skAttr && <>
                      <input type="hidden" name="sk_name" value={skAttr.name} />
                      <input type="hidden" name="sk_type" value={skAttr.data_type} />
                      <input type="hidden" name="sk_value" value={String(item.attributes[skAttr.name]?.value || '')} />
                    </>}
                    <ConfirmSubmitButton message="このアイテムを削除しますか？" style={{
                      fontSize: '12px', padding: '3px 8px', borderRadius: '6px',
                      backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171',
                      border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', marginTop: '8px',
                    }}>
                      🗑️ 削除
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
