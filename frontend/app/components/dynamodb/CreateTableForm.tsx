'use client';
// DynamoDB テーブル作成フォーム（AWS の CreateTable と同じ項目）
// テーブル名 / パーティションキー / ソートキー / GSI / LSI / 課金モード。キー以外の属性は定義しない（スキーマレス）。
import { useState } from 'react';

type KeyType = 'S' | 'N' | 'B';
type Projection = 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
interface Gsi { id: number; name: string; pk: string; pkType: KeyType; sk: string; skType: KeyType; projection: Projection; nonKey: string; }
interface Lsi { id: number; name: string; sk: string; skType: KeyType; projection: Projection; nonKey: string; }

let seq = 0;
const nid = () => ++seq;

const KEY_TYPES: { v: KeyType; label: string }[] = [
  { v: 'S', label: 'S 文字列' }, { v: 'N', label: 'N 数値' }, { v: 'B', label: 'B バイナリ' },
];
const grid = (cols: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: cols, gap: '8px', alignItems: 'center', marginBottom: '8px' });
const h3: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#fff', margin: '18px 0 6px' };
const hint: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' };
const small: React.CSSProperties = { padding: '6px 10px', fontSize: '12px' };
const removeBtn: React.CSSProperties = {
  ...small, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer',
};

function TypeSelect({ value, onChange }: { value: KeyType; onChange: (v: KeyType) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as KeyType)}>
      {KEY_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
    </select>
  );
}

function ProjectionSelect({ value, nonKey, onChange }: { value: Projection; nonKey: string; onChange: (p: Projection, nonKey: string) => void }) {
  return (
    <>
      <select value={value} onChange={e => onChange(e.target.value as Projection, nonKey)}>
        <option value="ALL">ALL</option>
        <option value="KEYS_ONLY">KEYS_ONLY</option>
        <option value="INCLUDE">INCLUDE</option>
      </select>
      <input value={nonKey} onChange={e => onChange(value, e.target.value)} disabled={value !== 'INCLUDE'}
        placeholder={value === 'INCLUDE' ? '射影する属性（カンマ区切り）' : '（INCLUDE のとき）'} />
    </>
  );
}

const splitList = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

export default function CreateTableForm() {
  const [tableName, setTableName] = useState('');
  const [pk, setPk] = useState('id');
  const [pkType, setPkType] = useState<KeyType>('S');
  const [sk, setSk] = useState('');
  const [skType, setSkType] = useState<KeyType>('S');
  const [gsis, setGsis] = useState<Gsi[]>([]);
  const [lsis, setLsis] = useState<Lsi[]>([]);
  const [billing, setBilling] = useState<'PAY_PER_REQUEST' | 'PROVISIONED'>('PAY_PER_REQUEST');
  const [rcu, setRcu] = useState(5);
  const [wcu, setWcu] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updGsi = (id: number, p: Partial<Gsi>) => setGsis(xs => xs.map(x => (x.id === id ? { ...x, ...p } : x)));
  const updLsi = (id: number, p: Partial<Lsi>) => setLsis(xs => xs.map(x => (x.id === id ? { ...x, ...p } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = {
      table_name: tableName.trim(),
      partition_key_name: pk.trim(),
      partition_key_type: pkType,
      sort_key_name: sk.trim() || null,
      sort_key_type: skType,
      billing_mode: billing,
      read_capacity_units: rcu,
      write_capacity_units: wcu,
      gsis: gsis.length ? gsis.map(g => ({
        name: g.name.trim(), partition_key: g.pk.trim(), partition_key_type: g.pkType,
        sort_key: g.sk.trim() || null, sort_key_type: g.skType,
        projection_type: g.projection, non_key_attributes: g.projection === 'INCLUDE' ? splitList(g.nonKey) : [],
      })) : null,
      lsis: lsis.length ? lsis.map(l => ({
        name: l.name.trim(), sort_key: l.sk.trim(), sort_key_type: l.skType,
        projection_type: l.projection, non_key_attributes: l.projection === 'INCLUDE' ? splitList(l.nonKey) : [],
      })) : null,
    };
    try {
      const res = await fetch('/api/dynamodb/create-table', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        setError(typeof d === 'string' ? d
          : Array.isArray(d) ? d.map((x: any) => `${(x.loc || []).slice(1).join('.')}: ${x.msg}`).join(' / ')
          : 'テーブル作成に失敗しました');
        setSubmitting(false);
        return;
      }
      window.location.href = `/dynamodb?msg=${encodeURIComponent(`テーブル "${payload.table_name}" を作成しました`)}`;
    } catch (err: any) {
      setError(err.message || '接続エラー');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <input value={tableName} onChange={e => setTableName(e.target.value)} placeholder="テーブル名 (例: Users)" required style={{ width: '100%', marginBottom: '4px' }} />
      <p style={hint}>3〜255 文字。英数字・<code>_</code>・<code>-</code>・<code>.</code> が使えます。</p>

      <h3 style={h3}>主キー</h3>
      <p style={hint}>キーにする属性だけを定義します。それ以外の属性はアイテムごとに自由です（スキーマレス）。</p>
      <div style={grid('130px 1fr 140px')}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>パーティションキー</span>
        <input value={pk} onChange={e => setPk(e.target.value)} placeholder="例: id" required />
        <TypeSelect value={pkType} onChange={setPkType} />
      </div>
      <div style={grid('130px 1fr 140px')}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ソートキー（任意）</span>
        <input value={sk} onChange={e => setSk(e.target.value)} placeholder="例: created_at" />
        <TypeSelect value={skType} onChange={setSkType} />
      </div>

      <h3 style={h3}>グローバルセカンダリインデックス（GSI）</h3>
      <p style={hint}>任意の属性をキーにした検索用インデックス。作成後に追加・削除も可能（このフォームでは作成時のみ）。</p>
      {gsis.map(g => (
        <div key={g.id} style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '8px' }}>
          <div style={grid('1fr 60px')}>
            <input value={g.name} onChange={e => updGsi(g.id, { name: e.target.value })} placeholder="インデックス名 (例: email-index)" required />
            <button type="button" style={removeBtn} onClick={() => setGsis(xs => xs.filter(x => x.id !== g.id))}>削除</button>
          </div>
          <div style={grid('1fr 140px 1fr 140px')}>
            <input value={g.pk} onChange={e => updGsi(g.id, { pk: e.target.value })} placeholder="パーティションキー" required />
            <TypeSelect value={g.pkType} onChange={v => updGsi(g.id, { pkType: v })} />
            <input value={g.sk} onChange={e => updGsi(g.id, { sk: e.target.value })} placeholder="ソートキー（任意）" />
            <TypeSelect value={g.skType} onChange={v => updGsi(g.id, { skType: v })} />
          </div>
          <div style={grid('140px 1fr')}>
            <ProjectionSelect value={g.projection} nonKey={g.nonKey} onChange={(p, n) => updGsi(g.id, { projection: p, nonKey: n })} />
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary" style={small}
        onClick={() => setGsis(xs => [...xs, { id: nid(), name: '', pk: '', pkType: 'S', sk: '', skType: 'S', projection: 'ALL', nonKey: '' }])}>
        ＋ GSI を追加
      </button>

      <h3 style={h3}>ローカルセカンダリインデックス（LSI）</h3>
      <p style={hint}>テーブルと同じパーティションキー ＋ 別のソートキー。テーブルにソートキーが必要で、テーブル作成時にしか作れません。</p>
      {lsis.map(l => (
        <div key={l.id} style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '8px' }}>
          <div style={grid('1fr 60px')}>
            <input value={l.name} onChange={e => updLsi(l.id, { name: e.target.value })} placeholder="インデックス名 (例: created-index)" required />
            <button type="button" style={removeBtn} onClick={() => setLsis(xs => xs.filter(x => x.id !== l.id))}>削除</button>
          </div>
          <div style={grid('1fr 1fr 140px')}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>PK: {pk || '-'}（テーブルと同じ）</span>
            <input value={l.sk} onChange={e => updLsi(l.id, { sk: e.target.value })} placeholder="ソートキー" required />
            <TypeSelect value={l.skType} onChange={v => updLsi(l.id, { skType: v })} />
          </div>
          <div style={grid('140px 1fr')}>
            <ProjectionSelect value={l.projection} nonKey={l.nonKey} onChange={(p, n) => updLsi(l.id, { projection: p, nonKey: n })} />
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary" style={small}
        onClick={() => setLsis(xs => [...xs, { id: nid(), name: '', sk: '', skType: 'S', projection: 'ALL', nonKey: '' }])}>
        ＋ LSI を追加
      </button>

      <h3 style={h3}>キャパシティ</h3>
      <div style={grid('1fr 100px 100px')}>
        <select value={billing} onChange={e => setBilling(e.target.value as any)}>
          <option value="PAY_PER_REQUEST">オンデマンド（PAY_PER_REQUEST）</option>
          <option value="PROVISIONED">プロビジョンド（PROVISIONED）</option>
        </select>
        <input type="number" min={1} value={rcu} onChange={e => setRcu(parseInt(e.target.value || '5', 10))} disabled={billing !== 'PROVISIONED'} title="読み込みキャパシティ（RCU）" />
        <input type="number" min={1} value={wcu} onChange={e => setWcu(parseInt(e.target.value || '5', 10))} disabled={billing !== 'PROVISIONED'} title="書き込みキャパシティ（WCU）" />
      </div>

      {error && <div className="alert-message alert-error" style={{ marginTop: '12px' }}>{error}</div>}
      <button type="submit" className="btn-primary" disabled={submitting || !tableName.trim() || !pk.trim()} style={{ marginTop: '12px' }}>
        {submitting ? '作成中…' : 'テーブルを作成'}
      </button>
    </form>
  );
}
