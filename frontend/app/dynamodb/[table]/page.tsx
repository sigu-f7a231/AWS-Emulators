// DynamoDB テーブル詳細ページ（アイテム一覧 ＋ 追加・置き換え ＋ 削除）
// AWS と同じくアイテムはスキーマレス。必須なのはキー属性だけ。
import ConfirmSubmitButton from '../../components/ConfirmSubmitButton';

type AV = Record<string, unknown>;
interface AttrValue { type: string; value: unknown; raw_dynamo: AV; }
interface ItemRecord { _raw: Record<string, AV>; attributes: Record<string, AttrValue>; }
interface KeyInfo { name: string; type: string; data_type: string; }
interface IndexInfo { name: string; keys: KeyInfo[]; projection: string; non_key_attributes?: string[]; }
interface TableDetail {
  name: string; status: string; item_count: number;
  keys: KeyInfo[]; gsis: IndexInfo[]; lsis: IndexInfo[];
  billing_mode: string; rcu: number; wcu: number;
}

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';
const SCAN_MAX = 1000;

async function getTableDetail(tableName: string): Promise<TableDetail | null> {
  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/tables`, { cache: 'no-store' });
    if (!res.ok) return null;
    const tables: TableDetail[] = await res.json();
    return tables.find(t => t.name === tableName) || null;
  } catch { return null; }
}

async function getItems(tableName: string): Promise<{ items: ItemRecord[]; error?: string }> {
  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/items?table=${encodeURIComponent(tableName)}`, { cache: 'no-store' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { items: [], error: typeof d.detail === 'string' ? d.detail : 'アイテムを取得できません' };
    }
    return { items: await res.json() };
  } catch (e: any) { return { items: [], error: e.message }; }
}

const TYPES: { t: string; label: string; hint: string }[] = [
  { t: 'S', label: '文字列', hint: 'テキスト' },
  { t: 'N', label: '数値', hint: '例: 123 / 4.56' },
  { t: 'B', label: 'バイナリ', hint: 'base64 (例: aGVsbG8=)' },
  { t: 'BOOL', label: 'Boolean', hint: 'true / false' },
  { t: 'NULL', label: 'Null', hint: '値は不要' },
  { t: 'M', label: 'マップ', hint: 'JSON 例: {"city":"Tokyo"}' },
  { t: 'L', label: 'リスト', hint: 'JSON 例: [1,"a",true]' },
  { t: 'SS', label: '文字列セット', hint: 'a, b, c または ["a","b"]' },
  { t: 'NS', label: '数値セット', hint: '1, 2, 3' },
  { t: 'BS', label: 'バイナリセット', hint: 'base64 のカンマ区切り' },
];
const TYPE_COLOR: Record<string, string> = {
  S: '#38bdf8', N: '#fb923c', B: '#94a3b8', BOOL: '#a78bfa', NULL: '#94a3b8',
  M: '#f472b6', L: '#34d399', SS: '#7dd3fc', NS: '#fdba74', BS: '#cbd5e1',
};

const show = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.substring(0, 80)}…` : s;
};

function TypeSelect({ defaultValue, keyOnly }: { defaultValue: string; keyOnly?: boolean }) {
  return (
    <select name="attr_type" defaultValue={defaultValue}>
      {TYPES.filter(x => !keyOnly || ['S', 'N', 'B'].includes(x.t)).map(x => (
        <option key={x.t} value={x.t}>{x.t} - {x.label}</option>
      ))}
    </select>
  );
}

export default async function TableDetailPage({
  params,
  searchParams,
}: {
  params: { table: string };
  searchParams: { msg?: string; err?: string };
}) {
  const tableName = decodeURIComponent(params.table);
  const [tableDetail, { items, error }] = await Promise.all([getTableDetail(tableName), getItems(tableName)]);
  const keys = [...(tableDetail?.keys || [])].sort((a, b) => (a.type === 'HASH' ? -1 : 1) - (b.type === 'HASH' ? -1 : 1));
  const typeHint = (t: string) => TYPES.find(x => x.t === t)?.hint || '';
  const jsonTemplate = JSON.stringify(
    Object.fromEntries(keys.map(k => [k.name, { [k.data_type]: k.data_type === 'N' ? '1' : k.data_type === 'B' ? 'aGVsbG8=' : 'value' }])),
    null, 2,
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <a href="/dynamodb" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>← DynamoDB</a>
        <span style={{ color: 'var(--border-color)' }}>/</span>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>🗄️ {tableName}</h1>
        {tableDetail && (
          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '99px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>{tableDetail.status}</span>
        )}
      </div>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}
      {!tableDetail && <div className="alert-message alert-error">テーブル「{tableName}」が見つかりません。</div>}
      {error && <div className="alert-message alert-error">{error}</div>}

      {tableDetail && (
        <article className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>テーブル情報</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '12px' }}>
            {[
              { label: 'アイテム数', value: tableDetail.item_count ?? 0 },
              { label: 'キャパシティ', value: tableDetail.billing_mode === 'PROVISIONED' ? `R ${tableDetail.rcu} / W ${tableDetail.wcu}` : 'オンデマンド' },
              { label: 'GSI', value: tableDetail.gsis?.length || 0 },
              { label: 'LSI', value: tableDetail.lsis?.length || 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {keys.map(k => (
              <span key={k.name} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', backgroundColor: 'rgba(255,153,0,0.12)', color: '#ff9900' }}>
                {k.type === 'HASH' ? '🔑 PK' : '📌 SK'} {k.name} ({k.data_type})
              </span>
            ))}
            {[...(tableDetail.gsis || []).map(g => ({ ...g, kind: 'GSI' })), ...(tableDetail.lsis || []).map(l => ({ ...l, kind: 'LSI' }))].map(ix => (
              <span key={ix.name} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                🔍 {ix.kind}: {ix.name} ({ix.keys.map(k => k.name).join(' + ')} / {ix.projection})
              </span>
            ))}
          </div>
        </article>
      )}

      {/* アイテム追加・置き換え（PutItem） */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px', color: '#fff' }}>➕ アイテムを作成・置き換え（PutItem）</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          必須なのはキー属性だけで、ほかの属性は自由に追加できます。同じキーのアイテムがあれば丸ごと置き換わります。値が空欄の行は保存されません。
        </p>
        <form method="POST" action="/api/dynamodb/put-item">
          <input type="hidden" name="table_name" value={tableName} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {keys.map(k => (
              <div key={k.name} style={{ display: 'grid', gridTemplateColumns: '180px 150px 1fr', gap: '8px' }}>
                <input name="attr_name" defaultValue={k.name} readOnly title="キー属性" style={{ color: '#ff9900' }} />
                <TypeSelect defaultValue={k.data_type} keyOnly />
                <input name="attr_value" placeholder={`${k.type === 'HASH' ? 'パーティションキー' : 'ソートキー'}（必須）${typeHint(k.data_type) ? ` ${typeHint(k.data_type)}` : ''}`} required />
              </div>
            ))}
            {[1, 2, 3, 4, 5].map(i => (
              <div key={`extra-${i}`} style={{ display: 'grid', gridTemplateColumns: '180px 150px 1fr', gap: '8px' }}>
                <input name="attr_name" placeholder={`属性名 ${i}`} />
                <TypeSelect defaultValue="S" />
                <input name="attr_value" placeholder="値（型ごとの書き方は下の一覧）" />
              </div>
            ))}
          </div>
          <details style={{ marginBottom: '12px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>型ごとの値の書き方</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '4px 16px', fontSize: '12px', marginTop: '8px' }}>
              {TYPES.map(x => (
                <span key={x.t}><b style={{ color: TYPE_COLOR[x.t] }}>{x.t}</b> {x.label}: <span style={{ color: 'var(--text-muted)' }}>{x.hint}</span></span>
              ))}
            </div>
          </details>
          <button type="submit" className="btn-primary">💾 保存</button>
        </form>

        <details style={{ marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#fff' }}>{'{ }'} DynamoDB JSON で入力する</summary>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0' }}>
            AWS コンソールの「JSON ビュー」と同じ形式です（B / BS は base64）。例: {'{"id": {"S": "u1"}, "tags": {"SS": ["a","b"]}, "profile": {"M": {"age": {"N": "30"}}}}'}
          </p>
          <form method="POST" action="/api/dynamodb/put-item">
            <input type="hidden" name="table_name" value={tableName} />
            <textarea name="item_json" rows={8} defaultValue={jsonTemplate} required
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', marginBottom: '10px' }} />
            <button type="submit" className="btn-primary">💾 JSON で保存</button>
          </form>
        </details>
      </article>

      {/* アイテム一覧（Scan） */}
      <article className="card">
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
          📋 アイテム ({items.length}{items.length >= SCAN_MAX ? '+' : ''} 件)
        </h2>
        {items.length >= SCAN_MAX && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>先頭 {SCAN_MAX} 件だけを表示しています。</p>
        )}
        {items.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>アイテムがありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item, idx) => {
              const keyJson = JSON.stringify(Object.fromEntries(keys.map(k => [k.name, item._raw[k.name]])));
              const ordered = [...keys.map(k => k.name), ...Object.keys(item.attributes).filter(n => !keys.some(k => k.name === n)).sort()];
              return (
                <div key={idx} style={{ padding: '14px 16px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    {ordered.filter(n => item.attributes[n]).map(k => {
                      const v = item.attributes[k];
                      const isKey = keys.some(x => x.name === k);
                      return (
                        <span key={k} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: isKey ? '#ff9900' : 'var(--text-muted)' }}>{k}:</span>
                          <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: `${TYPE_COLOR[v.type] || '#94a3b8'}22`, color: TYPE_COLOR[v.type] || '#94a3b8', fontFamily: 'monospace' }}>{v.type}</span>
                          <span style={{ color: '#fff', fontFamily: 'monospace' }}>{v.type === 'NULL' ? 'null' : show(v.value)}</span>
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                    <details style={{ flex: 1 }}>
                      <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>DynamoDB JSON</summary>
                      <pre style={{ marginTop: '6px', padding: '10px', backgroundColor: 'var(--code-bg)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(item._raw, null, 2)}
                      </pre>
                    </details>
                    {keys.length > 0 && (
                      <form method="POST" action="/api/dynamodb/delete-item" style={{ flexShrink: 0 }}>
                        <input type="hidden" name="table_name" value={tableName} />
                        <input type="hidden" name="key_json" value={keyJson} />
                        <ConfirmSubmitButton message="このアイテムを削除しますか？" style={{
                          fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.15)',
                          color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                        }}>🗑️ 削除</ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </div>
  );
}
