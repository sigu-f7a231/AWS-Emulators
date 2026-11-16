import React, { useState, useEffect } from 'react';
import { s3Service } from '../services/awsClient.ts';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/Card.tsx';
import { Button } from './ui/Button.tsx';
import { Badge } from './ui/Badge.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table.tsx';
import { CodeViewer } from './ui/CodeViewer.tsx';

interface S3Object {
  key: string;
  size: number;
  last_modified: string;
}

interface ObjectDetail {
  bucket: string;
  key: string;
  size: number;
  content_type: string;
  content: string;
  is_text: boolean;
}

export const S3Manager: React.FC = () => {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [selectedObject, setSelectedObject] = useState<ObjectDetail | null>(null);

  const [newBucketName, setNewBucketName] = useState('');
  const [newObjectKey, setNewObjectKey] = useState('');
  const [newObjectContent, setNewObjectContent] = useState('');

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchBuckets = async () => {
    try {
      const res = await s3Service.listBuckets();
      setBuckets(res.buckets || []);
      if (res.buckets?.length > 0 && !selectedBucket) {
        setSelectedBucket(res.buckets[0]);
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    }
  };

  const fetchObjects = async (bucket: string) => {
    try {
      const res = await s3Service.listObjects(bucket);
      setObjects(res.objects || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchObjectContent = async (bucket: string, key: string) => {
    setLoading(true);
    try {
      const res = await s3Service.getObjectContent(bucket, key);
      setSelectedObject(res);
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, []);

  useEffect(() => {
    if (selectedBucket) {
      fetchObjects(selectedBucket);
      setSelectedObject(null);
    } else {
      setObjects([]);
      setSelectedObject(null);
    }
  }, [selectedBucket]);

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName) return;
    setLoading(true);
    setNotification(null);
    try {
      await s3Service.createBucket(newBucketName);
      setNotification({ text: `✔ バケット '${newBucketName}' を作成しました`, isError: false });
      const created = newBucketName;
      setNewBucketName('');
      await fetchBuckets();
      setSelectedBucket(created);
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBucket = async (bucket: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`バケット '${bucket}' を削除しますか？`)) return;
    setLoading(true);
    try {
      await s3Service.deleteBucket(bucket);
      setNotification({ text: `✔ バケット '${bucket}' を削除しました`, isError: false });
      if (selectedBucket === bucket) setSelectedBucket(null);
      await fetchBuckets();
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handlePutObject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBucket || !newObjectKey) return;
    setLoading(true);
    setNotification(null);
    try {
      await s3Service.putObject(selectedBucket, newObjectKey, newObjectContent);
      setNotification({ text: `✔ オブジェクト '${newObjectKey}' を保存しました`, isError: false });
      const currentKey = newObjectKey;
      setNewObjectKey('');
      setNewObjectContent('');
      await fetchObjects(selectedBucket);
      await fetchObjectContent(selectedBucket, currentKey);
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteObject = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedBucket || !confirm(`オブジェクト '${key}' を削除しますか？`)) return;
    try {
      await s3Service.deleteObject(selectedBucket, key);
      setNotification({ text: `✔ オブジェクト '${key}' を削除しました`, isError: false });
      if (selectedObject?.key === key) setSelectedObject(null);
      await fetchObjects(selectedBucket);
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    }
  };

  return (
    <div>
      {notification && (
        <div className={`alert-message ${notification.isError ? 'alert-error' : 'alert-success'}`}>
          {notification.text}
        </div>
      )}

      <div className="grid-2">
        {/* Bucket List & Create */}
        <Card>
          <CardHeader>
            <CardTitle icon="🪣">Amazon S3 バケット一覧 ({buckets.length})</CardTitle>
            <Button variant="secondary" size="sm" onClick={fetchBuckets}>更新</Button>
          </CardHeader>
          <CardDescription>
            完全ローカルのオブジェクトストレージです。バケット作成やファイルのアップロードをテストできます。
          </CardDescription>

          <form onSubmit={handleCreateBucket} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="新規バケット名 (例: my-test-bucket)"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              pattern="[a-z0-9.-]+"
              title="小文字、数字、ハイフン、ピリオドのみ使用可能"
            />
            <Button type="submit" variant="primary" loading={loading} disabled={!newBucketName}>
              作成
            </Button>
          </form>

          {buckets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>バケットがありません。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {buckets.map((b) => (
                <div
                  key={b}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: selectedBucket === b ? '1px solid var(--aws-orange)' : '1px solid var(--border-color)',
                    backgroundColor: selectedBucket === b ? 'rgba(255,153,0,0.08)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => setSelectedBucket(b)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📁</span>
                    <strong style={{ fontSize: '14px', color: '#fff' }}>{b}</strong>
                    {selectedBucket === b && <Badge variant="orange" size="sm">選択中</Badge>}
                  </div>

                  <Button variant="danger" size="sm" onClick={(e) => handleDeleteBucket(b, e)}>
                    削除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Objects Explorer in Selected Bucket */}
        <Card>
          <CardHeader>
            <CardTitle icon="📄">
              オブジェクト管理 {selectedBucket && <span style={{ color: 'var(--aws-orange)' }}>({selectedBucket})</span>}
            </CardTitle>
            {selectedBucket && (
              <Button variant="secondary" size="sm" onClick={() => fetchObjects(selectedBucket)}>更新</Button>
            )}
          </CardHeader>

          {!selectedBucket ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>左側からバケットを選択してください。</p>
          ) : (
            <>
              {/* Upload Form */}
              <form onSubmit={handlePutObject} style={{ padding: '14px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--aws-orange)', marginBottom: '8px' }}>
                  ＋ オブジェクトを作成 / アップロード
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="ファイルキー/パス (例: config.json, docs/sample.txt)"
                    value={newObjectKey}
                    onChange={(e) => setNewObjectKey(e.target.value)}
                    required
                  />
                  <textarea
                    rows={3}
                    placeholder="ファイル内容 (テキスト・JSONなど)"
                    value={newObjectContent}
                    onChange={(e) => setNewObjectContent(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" variant="primary" loading={loading} disabled={!newObjectKey}>
                  保存 (PutObject)
                </Button>
              </form>

              {/* Objects List */}
              {objects.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>オブジェクトはありません。</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ファイルキー (パス)</TableHead>
                      <TableHead style={{ width: '100px' }}>サイズ</TableHead>
                      <TableHead style={{ width: '120px', textAlign: 'right' }}>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {objects.map((obj) => (
                      <TableRow
                        key={obj.key}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedObject?.key === obj.key ? 'rgba(255,153,0,0.08)' : undefined,
                        }}
                        onClick={() => fetchObjectContent(selectedBucket, obj.key)}
                      >
                        <TableCell style={{ fontWeight: 600, color: '#fff' }}>
                          📄 {obj.key}
                        </TableCell>
                        <TableCell style={{ color: 'var(--text-muted)' }}>
                          {obj.size} bytes
                        </TableCell>
                        <TableCell style={{ textAlign: 'right' }}>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => handleDeleteObject(obj.key, e)}
                          >
                            削除
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Selected Object Content Viewer */}
      {selectedObject && (
        <Card highlight style={{ marginTop: '24px' }}>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CardTitle icon="🔍">ファイル内容プレビュー: {selectedObject.key}</CardTitle>
              <Badge variant="green">{selectedObject.size} bytes</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedObject(null)}>✕ 閉じる</Button>
          </CardHeader>

          <CodeViewer
            code={selectedObject.content}
            language={selectedObject.key.endsWith('.json') ? 'json' : 'text'}
            maxHeight="350px"
          />
        </Card>
      )}
    </div>
  );
};
