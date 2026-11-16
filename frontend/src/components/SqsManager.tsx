import React, { useState, useEffect } from 'react';

interface QueueInfo {
  url: string;
  name: string;
  message_count: number;
}

interface SqsMessage {
  id: string;
  body: string;
  receipt_handle: string;
}

export const SqsManager: React.FC = () => {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [messages, setMessages] = useState<SqsMessage[]>([]);
  const [newQueueName, setNewQueueName] = useState('');
  const [standardMessage, setStandardMessage] = useState('');

  // Email task fields
  const [emailTo, setEmailTo] = useState('user@example.com');
  const [emailSubject, setEmailSubject] = useState('SQSタスク通知');
  const [emailBody, setEmailBody] = useState('SQSキュー経由で送信されたメール本文です。');

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchQueues = async () => {
    try {
      const res = await fetch('/api/sqs/queues');
      const data = await res.json();
      if (res.ok) {
        setQueues(data.queues || []);
        if (data.queues?.length > 0 && !selectedQueue) {
          setSelectedQueue(data.queues[0].name);
        }
      } else {
        setNotification({ text: data.detail || 'キュー一覧の取得に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    }
  };

  const fetchMessages = async (queueName: string) => {
    try {
      const res = await fetch(`/api/sqs/queues/${queueName}/messages`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  useEffect(() => {
    if (selectedQueue) {
      fetchMessages(selectedQueue);
    } else {
      setMessages([]);
    }
  }, [selectedQueue]);

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/sqs/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue_name: newQueueName }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: data.message, isError: false });
        setNewQueueName('');
        await fetchQueues();
        setSelectedQueue(newQueueName);
      } else {
        setNotification({ text: data.detail || 'キュー作成に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQueue = async (qName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`キュー '${qName}' を削除しますか？`)) return;
    try {
      const res = await fetch(`/api/sqs/queues/${qName}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: data.message, isError: false });
        if (selectedQueue === qName) setSelectedQueue(null);
        await fetchQueues();
      } else {
        setNotification({ text: data.detail || '削除に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    }
  };

  const handleSendStandardMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueue || !standardMessage) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sqs/queues/${selectedQueue}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_body: standardMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: `メッセージを送信しました (ID: ${data.message_id})`, isError: false });
        setStandardMessage('');
        await fetchQueues();
        await fetchMessages(selectedQueue);
      } else {
        setNotification({ text: data.detail || '送信に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueue || !emailTo) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sqs/queues/${selectedQueue}/send-email-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: emailTo,
          subject: emailSubject,
          body: emailBody,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: `メール送信タスクをキュー '${selectedQueue}' に投入しました！`, isError: false });
        await fetchQueues();
        await fetchMessages(selectedQueue);
      } else {
        setNotification({ text: data.detail || 'タスク投入に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessMessages = async () => {
    if (!selectedQueue) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sqs/queues/${selectedQueue}/process-messages`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          text: `キューから ${data.processed_count} 件のメールタスクを処理し送信しました！「メール履歴」タブで確認できます。`,
          isError: false,
        });
        await fetchQueues();
        await fetchMessages(selectedQueue);
      } else {
        setNotification({ text: data.detail || '処理に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
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
        {/* Queue List */}
        <div className="card">
          <h2 className="card-title">📬 Amazon SQS キュー一覧</h2>
          <form onSubmit={handleCreateQueue} className="form-group">
            <input
              type="text"
              placeholder="新規キュー名 (例: order-processing-queue)"
              value={newQueueName}
              onChange={(e) => setNewQueueName(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading || !newQueueName}>
              作成
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              キュー ({queues.length})
            </span>
            <button className="btn-secondary" onClick={fetchQueues}>更新</button>
          </div>

          <div className="item-list">
            {queues.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>キューがありません。</p>
            ) : (
              queues.map((q) => (
                <div
                  key={q.name}
                  className="item-row"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedQueue === q.name ? 'var(--aws-orange)' : 'var(--border-color)',
                    backgroundColor: selectedQueue === q.name ? 'rgba(255, 153, 0, 0.08)' : undefined,
                  }}
                  onClick={() => setSelectedQueue(q.name)}
                >
                  <div>
                    <div className="item-name">✉️ {q.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      未処理メッセージ数: <span style={{ color: 'var(--aws-orange)', fontWeight: 600 }}>{q.message_count}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedQueue === q.name && (
                      <span style={{ color: 'var(--aws-orange)', fontSize: '12px', fontWeight: 600 }}>選択中</span>
                    )}
                    <button
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '12px', color: '#ef4444' }}
                      onClick={(e) => handleDeleteQueue(q.name, e)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Queue Operations */}
        <div className="card">
          <h2 className="card-title">
            ⚙️ キュー操作 {selectedQueue && <span style={{ color: 'var(--aws-orange)' }}>({selectedQueue})</span>}
          </h2>

          {!selectedQueue ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>左側でキューを選択してください。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Email task form */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 153, 0, 0.2)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--aws-orange)', marginBottom: '8px' }}>
                  📧 メール送信タスクを投入する
                </h3>
                <form onSubmit={handleSendEmailTask} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="email"
                    placeholder="送信先メールアドレス"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="メール件名"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    required
                  />
                  <textarea
                    rows={2}
                    placeholder="メール本文"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      タスクをキューへ投入
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleProcessMessages}
                      disabled={loading}
                      title="キューに溜まったメールタスクを取り出して送信処理します"
                    >
                      ⚙️ キューのメールを処理・送信
                    </button>
                  </div>
                </form>
              </div>

              {/* Standard text message form */}
              <form onSubmit={handleSendStandardMessage}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  💬 通常メッセージ送信
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="送信メッセージ (JSONまたはテキスト)"
                    value={standardMessage}
                    onChange={(e) => setStandardMessage(e.target.value)}
                  />
                  <button type="submit" className="btn-primary" disabled={loading || !standardMessage}>
                    送信
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Messages Inside Selected Queue */}
      {selectedQueue && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📨 キュー内メッセージ ({messages.length})
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => fetchMessages(selectedQueue)}>
                🔄 メッセージを受信/更新
              </button>
              <button className="btn-secondary" onClick={handleProcessMessages} style={{ color: 'var(--aws-orange)' }}>
                ⚡ メールタスクを一括処理
              </button>
            </div>
          </div>

          <div className="item-list">
            {messages.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                現在キューにメッセージはありません。（または不可視時間中です）
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="item-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Message ID: <code>{m.id}</code>
                  </div>
                  <div className="code-box" style={{ width: '100%', margin: 0, padding: '8px 12px' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{m.body}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
