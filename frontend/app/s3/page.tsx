// S3 管理ページ（サーバーコンポーネント）
interface S3Object { key: string; size: number; last_modified: string; }

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

async function getBuckets(): Promise<string[]> {
  try {
    const res = await fetch(`${BACKEND}/api/s3/buckets`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.buckets || data || [];
  } catch { return []; }
}

async function getObjects(bucket: string): Promise<S3Object[]> {
  try {
    const res = await fetch(`${BACKEND}/api/s3/objects?bucket=${encodeURIComponent(bucket)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.objects || data || [];
  } catch { return []; }
}

export default async function S3Page({
  searchParams,
}: {
  searchParams: { bucket?: string; msg?: string; err?: string };
}) {
  const buckets = await getBuckets();
  const selectedBucket = searchParams.bucket || '';
  const objects = selectedBucket ? await getObjects(selectedBucket) : [];

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '24px' }}>🪣 S3 バケット管理</h1>

      {searchParams.msg && <div className="alert-message alert-success">{decodeURIComponent(searchParams.msg)}</div>}
      {searchParams.err && <div className="alert-message alert-error">{decodeURIComponent(searchParams.err)}</div>}

      <div className="grid-2">
        {/* バケット作成 */}
        <article className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>➕ バケット作成</h2>
          <form method="POST" action="/api/s3/create-bucket">
            <div className="form-group">
              <input name="bucket_name" placeholder="バケット名 (例: my-bucket)" required />
              <button type="submit" className="btn-primary">作成</button>
            </div>
          </form>
        </article>

        {/* バケット一覧 */}
        <article className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
            📋 バケット一覧 ({buckets.length})
          </h2>
          <div className="item-list">
            {buckets.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>バケットがありません</p>
            ) : buckets.map((b) => (
              <div key={b} className="item-row">
                <span className="item-name">🪣 {b}</span>
                <a
                  href={`/s3?bucket=${encodeURIComponent(b)}`}
                  style={{
                    padding: '4px 12px', fontSize: '13px', borderRadius: '6px',
                    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    color: 'var(--text-main)', textDecoration: 'none',
                  }}
                >
                  {selectedBucket === b ? '✅ 選択中' : '📂 開く'}
                </a>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* オブジェクト一覧 */}
      {selectedBucket && (
        <article className="card">
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>
            📂 {selectedBucket} のオブジェクト ({objects.length} 件)
          </h2>

          {/* オブジェクトアップロード */}
          <form method="POST" action="/api/s3/put-object" style={{ marginBottom: '20px' }}>
            <input type="hidden" name="bucket_name" value={selectedBucket} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input name="object_key" placeholder="オブジェクトキー (例: data/file.json)" required />
            </div>
            <textarea name="object_content" placeholder="ファイル内容" rows={4} style={{ width: '100%', marginBottom: '8px' }} />
            <button type="submit" className="btn-primary">📤 アップロード</button>
          </form>

          <div className="item-list">
            {objects.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>オブジェクトがありません</p>
            ) : objects.map((obj) => (
              <div key={obj.key} className="item-row">
                <span className="item-name">📄 {obj.key}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {obj.size != null ? `${(obj.size / 1024).toFixed(1)} KB` : ''}
                  </span>
                  <a
                    href={`/s3/${encodeURIComponent(selectedBucket)}/${encodeURIComponent(obj.key)}`}
                    style={{
                      padding: '4px 10px', fontSize: '12px', borderRadius: '6px',
                      backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      color: 'var(--text-main)', textDecoration: 'none',
                    }}
                  >
                    👁️ 表示
                  </a>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
