'use client';
// テーブル作成ビルダー（クライアントコンポーネント）
// カラム・主キー（PK/SK）・インデックス（GSI/LSI）・外部キーを行単位で追加して、DB にテーブルを作成する。
import { useMemo, useState } from 'react';

export interface ExistingTable {
  name: string;
  columns: { name: string; type: string }[];
  primary_key: { partition_key: string; sort_key?: string | null };
}

type ColType = 'S' | 'N' | 'B' | 'BOOL' | 'L' | 'M';
interface Col { id: number; name: string; type: ColType; required: boolean; description: string; }
interface Idx { id: number; name: string; type: 'GSI' | 'LSI'; partition_key: string; sort_key: string; projection_type: 'ALL' | 'KEYS_ONLY'; }
interface Fk { id: number; ref_table: string; columns: string[]; }

const COL_TYPES: { v: ColType; label: string }[] = [
  { v: 'S', label: 'S 文字列' }, { v: 'N', label: 'N 数値' }, { v: 'B', label: 'B バイナリ' },
  { v: 'BOOL', label: 'BOOL 真偽' }, { v: 'L', label: 'L リスト' }, { v: 'M', label: 'M マップ' },
];
const KEY_TYPES = new Set(['S', 'N', 'B']);

let seq = 100;
const nid = () => ++seq;

const sectionTitle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#fff', margin: '20px 0 8px' };
const hint: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' };
const row: React.CSSProperties = { display: 'grid', gap: '8px', alignItems: 'center', marginBottom: '6px' };
const small: React.CSSProperties = { padding: '6px 10px', fontSize: '12px' };
const removeBtn: React.CSSProperties = {
  ...small, background: 'rgba(239,68,68,0.12)', color: '#f87171',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer',
};

export default function TableBuilder({ dbName, existingTables }: { dbName: string; existingTables: ExistingTable[] }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<Col[]>([
    { id: 1, name: 'id', type: 'S', required: true, description: '' },
  ]);
  const [pk, setPk] = useState('id');
  const [sk, setSk] = useState('');
  const [indexes, setIndexes] = useState<Idx[]>([]);
  const [fks, setFks] = useState<Fk[]>([]);
  const [billing, setBilling] = useState<'PAY_PER_REQUEST' | 'PROVISIONED'>('PAY_PER_REQUEST');
  const [rcu, setRcu] = useState(5);
  const [wcu, setWcu] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const named = columns.filter(c => c.name.trim());
  const keyCols = named.filter(c => KEY_TYPES.has(c.type));
  const colType = (n: string) => columns.find(c => c.name.trim() === n)?.type;

  // 外部キーの参照先候補（同じ DB の既存テーブル ＋ 作成中のこのテーブル自身）
  const refTables = useMemo(() => {
    const list = existingTables.map(t => ({
      name: t.name,
      keys: [t.primary_key.partition_key, t.primary_key.sort_key].filter(Boolean) as string[],
      typeOf: (k: string) => t.columns.find(c => c.name === k)?.type || 'S',
    }));
    if (name.trim() && pk) {
      list.push({
        name: name.trim(),
        keys: [pk, sk].filter(Boolean),
        typeOf: (k: string) => colType(k) || 'S',
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTables, name, pk, sk, columns]);

  const updateCol = (id: number, patch: Partial<Col>) => setColumns(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const updateIdx = (id: number, patch: Partial<Idx>) => setIndexes(xs => xs.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const updateFk = (id: number, patch: Partial<Fk>) => setFks(xs => xs.map(x => (x.id === id ? { ...x, ...patch } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      description,
      columns: named.map(c => ({
        name: c.name.trim(), type: c.type,
        required: c.required || c.name.trim() === pk || c.name.trim() === sk,
        description: c.description,
      })),
      partition_key: pk,
      sort_key: sk || null,
      indexes: indexes.filter(i => i.name.trim()).map(i => ({
        name: i.name.trim(), type: i.type,
        partition_key: i.type === 'GSI' ? i.partition_key : null,
        sort_key: i.sort_key || null,
        projection_type: i.projection_type,
      })),
      foreign_keys: fks.filter(f => f.ref_table).map(f => ({ ref_table: f.ref_table, columns: f.columns })),
      billing_mode: billing,
      read_capacity_units: rcu,
      write_capacity_units: wcu,
    };
    try {
      const res = await fetch(`/api/dynamodb/databases/${encodeURIComponent(dbName)}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        setError(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => `${(x.loc || []).join('.')}: ${x.msg}`).join(' / ') : 'テーブル作成に失敗しました');
        setSubmitting(false);
        return;
      }
      window.location.href = `/dynamodb/databases/${encodeURIComponent(dbName)}?msg=${encodeURIComponent(data.message || 'テーブルを作成しました')}`;
    } catch (err: any) {
      setError(err.message || '接続エラー');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {/* 基本情報 */}
      <div style={{ ...row, gridTemplateColumns: '1fr 2fr' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="テーブル名 (例: orders)" required pattern="[A-Za-z0-9_\-]{1,100}" title="英数字・_・- の 1〜100 文字" />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="説明 (任意)" />
      </div>
      <p style={hint}>実テーブル名: <code style={{ color: '#38bdf8' }}>{dbName}.{name.trim() || '<テーブル名>'}</code></p>

      {/* カラム */}
      <h3 style={sectionTitle}>① カラム</h3>
      <p style={hint}>主キー・インデックス・外部キーに使うカラムは S / N / B 型にしてください。定義に無い属性もアイテムには自由に追加できます。</p>
      <div style={{ ...row, gridTemplateColumns: '1.2fr 130px 70px 1.5fr 60px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <span>カラム名</span><span>型</span><span>必須</span><span>説明</span><span />
      </div>
      {columns.map(c => {
        const isKey = c.name.trim() !== '' && (c.name.trim() === pk || c.name.trim() === sk);
        return (
          <div key={c.id} style={{ ...row, gridTemplateColumns: '1.2fr 130px 70px 1.5fr 60px' }}>
            <input value={c.name} onChange={e => updateCol(c.id, { name: e.target.value })} placeholder="カラム名" />
            <select value={c.type} onChange={e => updateCol(c.id, { type: e.target.value as ColType })}>
              {COL_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }} title={isKey ? '主キーは常に必須' : ''}>
              <input type="checkbox" checked={c.required || isKey} disabled={isKey}
                onChange={e => updateCol(c.id, { required: e.target.checked })} style={{ flex: 'none', width: '16px', height: '16px' }} />
              {isKey ? 'キー' : ''}
            </label>
            <input value={c.description} onChange={e => updateCol(c.id, { description: e.target.value })} placeholder="説明 (任意)" />
            <button type="button" style={removeBtn} disabled={columns.length <= 1}
              onClick={() => setColumns(cs => cs.filter(x => x.id !== c.id))}>削除</button>
          </div>
        );
      })}
      <button type="button" className="btn-secondary" style={small}
        onClick={() => setColumns(cs => [...cs, { id: nid(), name: '', type: 'S', required: false, description: '' }])}>
        ＋ カラムを追加
      </button>

      {/* 主キー */}
      <h3 style={sectionTitle}>② 主キー (Primary Key)</h3>
      <div style={{ ...row, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>パーティションキー (必須)
          <select value={pk} onChange={e => setPk(e.target.value)} required style={{ width: '100%', marginTop: '4px' }}>
            <option value="">── 選択 ──</option>
            {keyCols.map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()} ({c.type})</option>)}
          </select>
        </label>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ソートキー (任意)
          <select value={sk} onChange={e => setSk(e.target.value)} style={{ width: '100%', marginTop: '4px' }}>
            <option value="">なし</option>
            {keyCols.filter(c => c.name.trim() !== pk).map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()} ({c.type})</option>)}
          </select>
        </label>
      </div>

      {/* インデックス */}
      <h3 style={sectionTitle}>③ インデックス (GSI / LSI)</h3>
      <p style={hint}>GSI: 任意のカラムをキーにした検索用インデックス。LSI: テーブルと同じパーティションキーで別のソートキー（テーブルにソートキーが必要・作成後は追加不可）。</p>
      {indexes.map(ix => (
        <div key={ix.id} style={{ ...row, gridTemplateColumns: '1.2fr 90px 1fr 1fr 120px 60px' }}>
          <input value={ix.name} onChange={e => updateIdx(ix.id, { name: e.target.value })} placeholder="インデックス名 (3文字以上)" />
          <select value={ix.type} onChange={e => updateIdx(ix.id, { type: e.target.value as 'GSI' | 'LSI' })}>
            <option value="GSI">GSI</option>
            <option value="LSI" disabled={!sk}>LSI</option>
          </select>
          {ix.type === 'GSI' ? (
            <select value={ix.partition_key} onChange={e => updateIdx(ix.id, { partition_key: e.target.value })}>
              <option value="">PK を選択</option>
              {keyCols.map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()} ({c.type})</option>)}
            </select>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PK: {pk || '-'}（テーブルと同じ）</span>
          )}
          <select value={ix.sort_key} onChange={e => updateIdx(ix.id, { sort_key: e.target.value })}>
            <option value="">{ix.type === 'LSI' ? 'SK を選択' : 'SK なし'}</option>
            {keyCols.filter(c => c.name.trim() !== (ix.type === 'GSI' ? ix.partition_key : pk) && (ix.type === 'GSI' || c.name.trim() !== sk))
              .map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()} ({c.type})</option>)}
          </select>
          <select value={ix.projection_type} onChange={e => updateIdx(ix.id, { projection_type: e.target.value as 'ALL' | 'KEYS_ONLY' })}>
            <option value="ALL">ALL</option>
            <option value="KEYS_ONLY">KEYS_ONLY</option>
          </select>
          <button type="button" style={removeBtn} onClick={() => setIndexes(xs => xs.filter(x => x.id !== ix.id))}>削除</button>
        </div>
      ))}
      <button type="button" className="btn-secondary" style={small}
        onClick={() => setIndexes(xs => [...xs, { id: nid(), name: '', type: 'GSI', partition_key: '', sort_key: '', projection_type: 'ALL' }])}>
        ＋ インデックスを追加
      </button>

      {/* 外部キー */}
      <h3 style={sectionTitle}>④ 外部キー（他テーブルとの紐づけ）</h3>
      <p style={hint}>参照先テーブルの主キーに対応させるカラムを選びます。アイテム保存時、参照先に同じキーのアイテムが無いとエラーになります（値が空なら未チェック）。</p>
      {refTables.length === 0 && fks.length === 0 && (
        <p style={{ ...hint, fontStyle: 'italic' }}>この DB にはまだ他のテーブルがありません（テーブル名を入れると自己参照は設定できます）。</p>
      )}
      {fks.map(fk => {
        const ref = refTables.find(r => r.name === fk.ref_table);
        return (
          <div key={fk.id} style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '8px' }}>
            <div style={{ ...row, gridTemplateColumns: '1fr 60px' }}>
              <select value={fk.ref_table} onChange={e => {
                const r = refTables.find(x => x.name === e.target.value);
                updateFk(fk.id, { ref_table: e.target.value, columns: (r?.keys || []).map(() => '') });
              }}>
                <option value="">参照先テーブルを選択</option>
                {refTables.map(r => (
                  <option key={r.name} value={r.name}>
                    {r.name}{r.name === name.trim() ? '（このテーブル自身）' : ''}  — 主キー: {r.keys.join(' + ')}
                  </option>
                ))}
              </select>
              <button type="button" style={removeBtn} onClick={() => setFks(xs => xs.filter(x => x.id !== fk.id))}>削除</button>
            </div>
            {ref && ref.keys.map((rk, i) => {
              const t = ref.typeOf(rk);
              return (
                <div key={rk} style={{ ...row, gridTemplateColumns: '1fr 30px 1fr', fontSize: '13px' }}>
                  <select value={fk.columns[i] || ''} onChange={e => {
                    const cols = [...fk.columns]; cols[i] = e.target.value; updateFk(fk.id, { columns: cols });
                  }}>
                    <option value="">このテーブルのカラム（{t} 型）</option>
                    {named.filter(c => c.type === t).map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()}</option>)}
                  </select>
                  <span style={{ textAlign: 'center', color: 'var(--aws-orange)' }}>→</span>
                  <span><code style={{ color: '#38bdf8' }}>{ref.name}.{rk}</code> <span style={{ color: 'var(--text-muted)' }}>({t}{i === 0 ? ', PK' : ', SK'})</span></span>
                </div>
              );
            })}
          </div>
        );
      })}
      <button type="button" className="btn-secondary" style={small}
        onClick={() => setFks(xs => [...xs, { id: nid(), ref_table: '', columns: [] }])}>
        ＋ 外部キーを追加
      </button>

      {/* 課金 */}
      <h3 style={sectionTitle}>⑤ 課金モード</h3>
      <div style={{ ...row, gridTemplateColumns: '1fr 100px 100px' }}>
        <select value={billing} onChange={e => setBilling(e.target.value as any)}>
          <option value="PAY_PER_REQUEST">PAY_PER_REQUEST（オンデマンド）</option>
          <option value="PROVISIONED">PROVISIONED</option>
        </select>
        <input type="number" min={1} value={rcu} onChange={e => setRcu(parseInt(e.target.value || '5', 10))} disabled={billing !== 'PROVISIONED'} title="RCU" />
        <input type="number" min={1} value={wcu} onChange={e => setWcu(parseInt(e.target.value || '5', 10))} disabled={billing !== 'PROVISIONED'} title="WCU" />
      </div>

      {error && <div className="alert-message alert-error" style={{ marginTop: '16px' }}>{error}</div>}
      <button type="submit" className="btn-primary" disabled={submitting || !name.trim() || !pk} style={{ marginTop: '16px' }}>
        {submitting ? '作成中…' : '🛠️ テーブルを作成'}
      </button>
    </form>
  );
}
