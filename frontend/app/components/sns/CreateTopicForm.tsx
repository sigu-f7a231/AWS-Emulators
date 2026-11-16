'use client';
// トピックの作成（AWS コンソールと同じ: タイプ / 名前 / 表示名）
import { useState } from 'react';

const label: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px', display: 'block' };
const hint: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' };

export default function CreateTopicForm() {
  const [type, setType] = useState<'standard' | 'fifo'>('standard');
  const [name, setName] = useState('');
  const base = name.trim().replace(/\.fifo$/, '');
  const finalName = type === 'fifo' ? `${base}.fifo` : name.trim();
  const tooLong = finalName.length > 256;
  const badChars = base !== '' && !/^[A-Za-z0-9_-]+$/.test(base);

  const typeCard = (v: 'standard' | 'fifo', title: string, desc: string) => (
    <label style={{
      flex: 1, minWidth: '180px', display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer',
      padding: '10px 12px', borderRadius: '8px',
      border: `1px solid ${type === v ? 'var(--aws-orange)' : 'var(--border-color)'}`,
      backgroundColor: type === v ? 'rgba(255,153,0,0.08)' : 'var(--bg-primary)',
    }}>
      <input type="radio" name="topic_type" value={v} checked={type === v} onChange={() => setType(v)}
        style={{ flex: 'none', width: '16px', height: '16px', marginTop: '2px' }} />
      <span>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: '#fff' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</span>
      </span>
    </label>
  );

  return (
    <form method="POST" action="/api/sns/create-topic">
      <span style={label}>タイプ</span>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
        {typeCard('fifo', 'FIFO（先入れ先出し）', '順序を厳密に保持・重複排除。SQS の購読のみ（Eメール不可）')}
        {typeCard('standard', 'スタンダード', 'ベストエフォート順序・少なくとも 1 回配信。SQS / Eメールなど')}
      </div>
      <p style={hint}>トピックの作成後にタイプは変更できません。</p>

      <label style={{ ...label, marginTop: '14px' }} htmlFor="topic-name">名前</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input id="topic-name" name="topic_name" value={name} onChange={e => setName(e.target.value)}
          placeholder="MyTopic" required style={{ flex: 1 }} />
        {type === 'fifo' && <code style={{ color: 'var(--text-muted)' }}>.fifo</code>}
      </div>
      <p style={hint}>
        最大 256 文字。英数字・ハイフン（-）・アンダースコア（_）を使えます。{type === 'fifo' && '末尾に .fifo が付きます。'}
        {finalName && <> 作成される名前: <code style={{ color: '#38bdf8' }}>{finalName}</code></>}
      </p>
      {(badChars || tooLong) && (
        <div className="alert-message alert-error" style={{ marginTop: '6px' }}>
          {badChars ? '名前には英数字・ハイフン（-）・アンダースコア（_）だけを使えます。' : '名前は 256 文字以内にしてください。'}
        </div>
      )}

      <label style={{ ...label, marginTop: '14px' }} htmlFor="topic-display">表示名 - <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>オプション</span></label>
      <input id="topic-display" name="display_name" maxLength={100} placeholder="My Topic" style={{ width: '100%' }} />
      <p style={hint}>Eメールの購読者に送るメールの送信者名に使われます。最大 100 文字。</p>

      {type === 'fifo' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '12px', cursor: 'pointer' }}>
          <input type="checkbox" name="content_based_deduplication" style={{ flex: 'none', width: '16px', height: '16px' }} />
          コンテンツベースのメッセージ重複排除（本文から重複排除 ID を自動で作る）
        </label>
      )}

      <button type="submit" className="btn-primary" style={{ marginTop: '16px' }} disabled={!base || badChars || tooLong}>
        トピックの作成
      </button>
    </form>
  );
}
