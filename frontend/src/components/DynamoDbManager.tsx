import React, { useState, useEffect } from 'react';
import { dynamoService, ItemAttributeDef } from '../services/awsClient.ts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card.tsx';
import { Button } from './ui/Button.tsx';
import { Badge } from './ui/Badge.tsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table.tsx';
import { CodeViewer } from './ui/CodeViewer.tsx';

interface TableKeyInfo {
  name: string;
  type: string;
  data_type: string;
}

interface TableDetail {
  name: string;
  status: string;
  item_count: number;
  size_bytes: number;
  keys: TableKeyInfo[];
  arn?: string;
}

interface ItemRecord {
  _raw: Record<string, any>;
  attributes: Record<string, { type: string; value: any; raw_dynamo: any }>;
}

export const DynamoDbManager: React.FC = () => {
  const [tables, setTables] = useState<TableDetail[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableDetail | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);

  // Create Table Form States
  const [newTableName, setNewTableName] = useState('');
  const [pkName, setPkName] = useState('id');
  const [pkType, setPkType] = useState<'S' | 'N' | 'B'>('S');
  const [useSortKey, setUseSortKey] = useState(false);
  const [skName, setSkName] = useState('timestamp');
  const [skType, setSkType] = useState<'S' | 'N' | 'B'>('N');

  // Item Editor Form States (Dynamic Attributes with Types)
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [editingItemRaw, setEditingItemRaw] = useState<Record<string, any> | null>(null);
  const [itemAttributes, setItemAttributes] = useState<ItemAttributeDef[]>([
    { name: 'id', type: 'S', value: 'item_101' },
    { name: 'title', type: 'S', value: 'サンプルアイテム' },
    { name: 'price', type: 'N', value: '1500' },
    { name: 'isAvailable', type: 'BOOL', value: 'true' },
  ]);

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchTables = async () => {
    try {
      const res = await dynamoService.listTables();
      setTables(res.tables || []);
      if (res.tables?.length > 0 && !selectedTable) {
        setSelectedTable(res.tables[0]);
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    }
  };

  const fetchItems = async (tableName: string) => {
    try {
      const res = await dynamoService.scanItems(tableName);
      setItems(res.items || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchItems(selectedTable.name);
      setShowItemEditor(false);
    } else {
      setItems([]);
    }
  }, [selectedTable]);

  // Create Table Handler
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName || !pkName) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await dynamoService.createTable(
        newTableName,
        pkName,
        pkType,
        useSortKey ? skName : undefined,
        useSortKey ? skType : undefined
      );
      setNotification({ text: `✔ テーブル '${newTableName}' を作成しました！`, isError: false });
      setNewTableName('');
      await fetchTables();
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Delete Table Handler
  const handleDeleteTable = async (tName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`テーブル '${tName}' を完全に削除しますか？`)) return;
    setLoading(true);
    try {
      await dynamoService.deleteTable(tName);
      setNotification({ text: `✔ テーブル '${tName}' を削除しました`, isError: false });
      if (selectedTable?.name === tName) setSelectedTable(null);
      await fetchTables();
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Open Item Editor for New Item
  const handleOpenNewItem = () => {
    if (!selectedTable) return;
    const initialAttrs: ItemAttributeDef[] = selectedTable.keys.map((k) => ({
      name: k.name,
      type: k.data_type as any,
      value: k.data_type === 'N' ? '1' : 'id_' + Math.floor(Math.random() * 1000),
    }));
    // Add default attributes
    initialAttrs.push({ name: 'name', type: 'S', value: '商品A' });
    initialAttrs.push({ name: 'count', type: 'N', value: '10' });

    setItemAttributes(initialAttrs);
    setEditingItemRaw(null);
    setShowItemEditor(true);
  };

  // Open Item Editor for Existing Item (Load and allow changing data types!)
  const handleEditItem = (item: ItemRecord) => {
    const loadedAttrs: ItemAttributeDef[] = Object.entries(item.attributes).map(([attrName, detail]) => ({
      name: attrName,
      type: detail.type as any,
      value: String(detail.value),
    }));
    setItemAttributes(loadedAttrs);
    setEditingItemRaw(item._raw);
    setShowItemEditor(true);
  };

  // Dynamic Attribute Handlers
  const handleAddAttributeRow = () => {
    setItemAttributes([...itemAttributes, { name: '', type: 'S', value: '' }]);
  };

  const handleRemoveAttributeRow = (idx: number) => {
    setItemAttributes(itemAttributes.filter((_, i) => i !== idx));
  };

  const handleAttributeChange = (idx: number, field: keyof ItemAttributeDef, val: any) => {
    const updated = [...itemAttributes];
    updated[idx] = { ...updated[idx], [field]: val };
    setItemAttributes(updated);
  };

  // Save Item (PutItem)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setLoading(true);
    setNotification(null);
    try {
      await dynamoService.putItem(selectedTable.name, itemAttributes);
      setNotification({ text: '✔ アイテムを保存しました（データ型変更が適用されました）！', isError: false });
      setShowItemEditor(false);
      await fetchItems(selectedTable.name);
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (item: ItemRecord) => {
    if (!selectedTable || !confirm('このアイテムを削除しますか？')) return;
    // Extract key attributes
    const keyPayload: Record<string, any> = {};
    for (const k of selectedTable.keys) {
      if (item._raw[k.name]) {
        keyPayload[k.name] = item._raw[k.name];
      }
    }

    try {
      await dynamoService.deleteItem(selectedTable.name, keyPayload);
      setNotification({ text: '✔ アイテムを削除しました', isError: false });
      await fetchItems(selectedTable.name);
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

      {/* Table Creation Card */}
      <Card>
        <CardHeader>
          <CardTitle icon="⚡">Amazon DynamoDB テーブル作成 (キー型・スキーマ定義)</CardTitle>
        </CardHeader>
        <CardDescription>
          NoSQLデータベースとしてテーブルを作成します。パーティションキーおよびソートキーのデータ型（String, Number, Binary）を厳密に定義可能です。
        </CardDescription>

        <form onSubmit={handleCreateTable}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                テーブル名:
              </label>
              <input
                type="text"
                placeholder="例: Products, Users, Orders"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                パーティションキー (PK) 名:
              </label>
              <input
                type="text"
                placeholder="例: id, userId"
                value={pkName}
                onChange={(e) => setPkName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                PK データタイプ:
              </label>
              <select
                value={pkType}
                onChange={(e) => setPkType(e.target.value as any)}
                style={{ width: '100%' }}
              >
                <option value="S">String (文字列: S)</option>
                <option value="N">Number (数値: N)</option>
                <option value="B">Binary (バイナリ: B)</option>
              </select>
            </div>
          </div>

          {/* Optional Sort Key Section */}
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: useSortKey ? '10px' : '0' }}>
              <input
                type="checkbox"
                id="use_sk"
                checked={useSortKey}
                onChange={(e) => setUseSortKey(e.target.checked)}
                style={{ width: '16px', height: '16px', flex: 'none' }}
              />
              <label htmlFor="use_sk" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                ソートキー (RANGE) を設定する (複合プライマリキー)
              </label>
            </div>

            {useSortKey && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    ソートキー (SK) 名:
                  </label>
                  <input
                    type="text"
                    placeholder="例: createdAt, timestamp, version"
                    value={skName}
                    onChange={(e) => setSkName(e.target.value)}
                    required={useSortKey}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    SK データタイプ:
                  </label>
                  <select
                    value={skType}
                    onChange={(e) => setSkType(e.target.value as any)}
                    style={{ width: '100%' }}
                  >
                    <option value="N">Number (数値: N)</option>
                    <option value="S">String (文字列: S)</option>
                    <option value="B">Binary (バイナリ: B)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" variant="primary" loading={loading} disabled={!newTableName}>
            ⚡ テーブルを作成する (CreateTable)
          </Button>
        </form>
      </Card>

      {/* Tables and Item Explorer */}
      <div className="grid-2">
        {/* Table List Card */}
        <Card>
          <CardHeader>
            <CardTitle icon="🗄️">テーブル一覧 ({tables.length})</CardTitle>
            <Button variant="secondary" size="sm" onClick={fetchTables}>更新</Button>
          </CardHeader>

          {tables.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              作成されたテーブルはありません。上のフォームから作成してください。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tables.map((t) => (
                <div
                  key={t.name}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: selectedTable?.name === t.name ? '1px solid var(--aws-orange)' : '1px solid var(--border-color)',
                    backgroundColor: selectedTable?.name === t.name ? 'rgba(255,153,0,0.08)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => setSelectedTable(t)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: '#fff' }}>{t.name}</strong>
                      <Badge variant="green" size="sm">{t.status}</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {t.keys.map((k) => (
                        <Badge key={k.name} variant="blue" size="sm">
                          {k.type === 'HASH' ? 'PK' : 'SK'}: {k.name} ({k.data_type})
                        </Badge>
                      ))}
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                        | アイテム数: {t.item_count}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => handleDeleteTable(t.name, e)}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Selected Table Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle icon="📊">
              テーブル詳細 {selectedTable && <span style={{ color: 'var(--aws-orange)' }}>({selectedTable.name})</span>}
            </CardTitle>
          </CardHeader>

          {!selectedTable ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              左側のリストからテーブルを選択してください。
            </p>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', marginBottom: '16px' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>ステータス:</span> <strong>{selectedTable.status}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>課金モード:</span> <strong>PAY_PER_REQUEST</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>項目数 (ItemCount):</span> <strong>{items.length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>サイズ:</span> <strong>{selectedTable.size_bytes} bytes</strong></div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--aws-orange)', marginBottom: '8px' }}>
                  🔑 プライマリキースキーマ:
                </h4>
                {selectedTable.keys.map((k) => (
                  <div key={k.name} style={{ fontSize: '12px', padding: '4px 0' }}>
                    • <strong>{k.name}</strong> ({k.type === 'HASH' ? 'パーティションキー' : 'ソートキー'}) ➔ データ型: <code>{k.data_type}</code>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px' }}>
                <Button variant="primary" onClick={handleOpenNewItem} style={{ width: '100%' }}>
                  ＋ 新規アイテムを作成 (データ型自由定義)
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Item Editor (Dynamic Data Types & Attributes) */}
      {showItemEditor && selectedTable && (
        <Card highlight style={{ marginTop: '24px' }}>
          <CardHeader>
            <CardTitle icon="✏️">
              {editingItemRaw ? 'アイテム編集 (データ型・属性値の変更)' : `新規アイテム作成 (${selectedTable.name})`}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowItemEditor(false)}>✕ 閉じる</Button>
          </CardHeader>
          <CardDescription>
            各属性（カラム）の<strong>データ型（String, Number, Boolean, List, Map, Null）</strong>を自由に指定・変更できます。
          </CardDescription>

          <form onSubmit={handleSaveItem}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '220px' }}>属性名 (Attribute Name)</TableHead>
                  <TableHead style={{ width: '200px' }}>データ型 (Data Type)</TableHead>
                  <TableHead>属性値 (Value)</TableHead>
                  <TableHead style={{ width: '80px' }}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemAttributes.map((attr, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <input
                        type="text"
                        placeholder="属性名 (例: title, price)"
                        value={attr.name}
                        onChange={(e) => handleAttributeChange(idx, 'name', e.target.value)}
                        required
                        style={{ fontSize: '13px', padding: '6px 10px' }}
                      />
                    </TableCell>

                    <TableCell>
                      <select
                        value={attr.type}
                        onChange={(e) => handleAttributeChange(idx, 'type', e.target.value)}
                        style={{ fontSize: '13px', padding: '6px 10px', width: '100%' }}
                      >
                        <option value="S">String (文字列: S)</option>
                        <option value="N">Number (数値: N)</option>
                        <option value="BOOL">Boolean (真偽値: BOOL)</option>
                        <option value="L">List (リスト: L)</option>
                        <option value="M">Map (マップ/JSON: M)</option>
                        <option value="NULL">Null (ヌル)</option>
                      </select>
                    </TableCell>

                    <TableCell>
                      {attr.type === 'BOOL' ? (
                        <select
                          value={String(attr.value)}
                          onChange={(e) => handleAttributeChange(idx, 'value', e.target.value)}
                          style={{ fontSize: '13px', padding: '6px 10px' }}
                        >
                          <option value="true">true (True)</option>
                          <option value="false">false (False)</option>
                        </select>
                      ) : attr.type === 'L' ? (
                        <input
                          type="text"
                          placeholder='例: ["tag1", "tag2"] または tag1, tag2'
                          value={attr.value}
                          onChange={(e) => handleAttributeChange(idx, 'value', e.target.value)}
                          style={{ fontSize: '13px', padding: '6px 10px' }}
                        />
                      ) : attr.type === 'M' ? (
                        <input
                          type="text"
                          placeholder='JSONオブジェクト (例: {"detail": "info", "code": 100})'
                          value={attr.value}
                          onChange={(e) => handleAttributeChange(idx, 'value', e.target.value)}
                          style={{ fontSize: '13px', padding: '6px 10px' }}
                        />
                      ) : attr.type === 'NULL' ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>NULL</span>
                      ) : (
                        <input
                          type={attr.type === 'N' ? 'number' : 'text'}
                          step="any"
                          placeholder="属性値"
                          value={attr.value}
                          onChange={(e) => handleAttributeChange(idx, 'value', e.target.value)}
                          required={attr.type !== 'NULL'}
                          style={{ fontSize: '13px', padding: '6px 10px' }}
                        />
                      )}
                    </TableCell>

                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleRemoveAttributeRow(idx)}
                      >
                        ✕
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddAttributeRow}>
                ＋ 属性行を追加
              </Button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="submit" variant="primary" loading={loading}>
                  💾 アイテムを保存 (PutItem)
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowItemEditor(false)}>
                  キャンセル
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Table Items Explorer Card */}
      {selectedTable && (
        <Card style={{ marginTop: '24px' }}>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CardTitle icon="📄">
                アイテム一覧 ({items.length}件)
              </CardTitle>
              <Badge variant="blue">{selectedTable.name}</Badge>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={() => fetchItems(selectedTable.name)}>
                🔄 更新
              </Button>
              <Button variant="primary" size="sm" onClick={handleOpenNewItem}>
                ＋ 新規アイテム追加
              </Button>
            </div>
          </CardHeader>

          {items.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>
              アイテムがまだ登録されていません。「＋ 新規アイテム追加」からデータを保存してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '120px' }}>プライマリキー</TableHead>
                  <TableHead>格納データ (属性名: [データ型] 値)</TableHead>
                  <TableHead style={{ width: '140px', textAlign: 'right' }}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const pkAttr = selectedTable.keys[0]?.name;
                  const pkVal = item.attributes[pkAttr]?.value || 'ID-' + idx;

                  return (
                    <TableRow key={idx}>
                      <TableCell style={{ fontWeight: 700, color: 'var(--aws-orange)' }}>
                        {String(pkVal)}
                      </TableCell>

                      <TableCell>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(item.attributes).map(([attrName, attrDetail]) => (
                            <div
                              key={attrName}
                              style={{
                                padding: '4px 8px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <span style={{ color: 'var(--text-muted)' }}>{attrName}:</span>
                              <Badge
                                variant={
                                  attrDetail.type === 'S'
                                    ? 'green'
                                    : attrDetail.type === 'N'
                                    ? 'blue'
                                    : attrDetail.type === 'BOOL'
                                    ? 'purple'
                                    : 'orange'
                                }
                                size="sm"
                              >
                                {attrDetail.type}
                              </Badge>
                              <span style={{ fontWeight: 600, color: '#fff' }}>
                                {String(attrDetail.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            title="データ型や属性値を編集"
                          >
                            ✏️ 編集 (型変更)
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteItem(item)}
                          >
                            削除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
};
