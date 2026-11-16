import React, { useState, useEffect } from 'react';

interface TopicInfo {
  arn: string;
  name: string;
}

interface SubscriptionInfo {
  arn: string;
  protocol: string;
  endpoint: string;
}

export const SnsManager: React.FC = () => {
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [selectedTopicArn, setSelectedTopicArn] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [newTopicName, setNewTopicName] = useState('');

  // Subscription form
  const [subscribeEmail, setSubscribeEmail] = useState('');

  // Publish form
  const [publishSubject, setPublishSubject] = useState('緊急通知: システムアラート');
  const [publishMessage, setPublishMessage] = useState('これは Amazon SNS トピック経由で送信されたテストメッセージです。');

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/sns/topics');
      const data = await res.json();
      if (res.ok) {
        setTopics(data.topics || []);
        if (data.topics?.length > 0 && !selectedTopicArn) {
          setSelectedTopicArn(data.topics[0].arn);
        }
      } else {
        setNotification({ text: data.detail || 'トピック一覧の取得に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    }
  };

  const fetchSubscriptions = async (topicArn: string) => {
    try {
      const res = await fetch(`/api/sns/topics/${encodeURIComponent(topicArn)}/subscriptions`);
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(data.subscriptions || []);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  useEffect(() => {
    if (selectedTopicArn) {
      fetchSubscriptions(selectedTopicArn);
    } else {
      setSubscriptions([]);
    }
  }, [selectedTopicArn]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/sns/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_name: newTopicName }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: data.message, isError: false });
        setNewTopicName('');
        await fetchTopics();
        if (data.topic_arn) setSelectedTopicArn(data.topic_arn);
      } else {
        setNotification({ text: data.detail || 'トピック作成に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTopic = async (topicArn: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`トピック '${topicArn.split(':').pop()}' を削除しますか？`)) return;
    try {
      const res = await fetch(`/api/sns/topics/${encodeURIComponent(topicArn)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: data.message, isError: false });
        if (selectedTopicArn === topicArn) setSelectedTopicArn(null);
        await fetchTopics();
      } else {
        setNotification({ text: data.detail || '削除に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    }
  };

  const handleSubscribeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicArn || !subscribeEmail) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sns/topics/${encodeURIComponent(selectedTopicArn)}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: 'email',
          endpoint: subscribeEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: `メールアドレス '${subscribeEmail}' をトピックに登録しました！`, isError: false });
        setSubscribeEmail('');
        await fetchSubscriptions(selectedTopicArn);
      } else {
        setNotification({ text: data.detail || 'サブスクリプション登録に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicArn || !publishMessage) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sns/topics/${encodeURIComponent(selectedTopicArn)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: publishSubject,
          message: publishMessage,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const count = data.dispatched_emails?.length || 0;
        setNotification({
          text: `メッセージを発行しました (ID: ${data.message_id})！登録済みメール ${count} 件に配信完了。「メール履歴」タブで確認できます。`,
          isError: false,
        });
      } else {
        setNotification({ text: data.detail || '発行に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const selectedTopicName = selectedTopicArn ? selectedTopicArn.split(':').pop() : '';

  return (
    <div>
      {notification && (
        <div className={`alert-message ${notification.isError ? 'alert-error' : 'alert-success'}`}>
          {notification.text}
        </div>
      )}

      <div className="grid-2">
        {/* Topic List */}
        <div className="card">
          <h2 className="card-title">📢 Amazon SNS トピック一覧</h2>
          <form onSubmit={handleCreateTopic} className="form-group">
            <input
              type="text"
              placeholder="新規トピック名 (例: alert-notifications)"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading || !newTopicName}>
              作成
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              トピック ({topics.length})
            </span>
            <button className="btn-secondary" onClick={fetchTopics}>更新</button>
          </div>

          <div className="item-list">
            {topics.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>トピックがありません。</p>
            ) : (
              topics.map((t) => (
                <div
                  key={t.arn}
                  className="item-row"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedTopicArn === t.arn ? 'var(--aws-orange)' : 'var(--border-color)',
                    backgroundColor: selectedTopicArn === t.arn ? 'rgba(255, 153, 0, 0.08)' : undefined,
                  }}
                  onClick={() => setSelectedTopicArn(t.arn)}
                >
                  <div>
                    <div className="item-name">📢 {t.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      {t.arn}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedTopicArn === t.arn && (
                      <span style={{ color: 'var(--aws-orange)', fontSize: '12px', fontWeight: 600 }}>選択中</span>
                    )}
                    <button
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '12px', color: '#ef4444' }}
                      onClick={(e) => handleDeleteTopic(t.arn, e)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Topic Operations (Publish & Subscribe) */}
        <div className="card">
          <h2 className="card-title">
            ⚙️ トピック管理 {selectedTopicName && <span style={{ color: 'var(--aws-orange)' }}>({selectedTopicName})</span>}
          </h2>

          {!selectedTopicArn ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>左側でトピックを選択してください。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Subscribe Email form */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 153, 0, 0.2)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--aws-orange)', marginBottom: '8px' }}>
                  📧 メールアドレスをサブスクライブ（登録）
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  登録したメールアドレス宛てに、トピック発行時に通知メールが配信されます。
                </p>
                <form onSubmit={handleSubscribeEmail} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    placeholder="例: admin@example.com"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={loading || !subscribeEmail}>
                    メールアドレスを登録
                  </button>
                </form>
              </div>

              {/* Publish form */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  🚀 メッセージ発行 (Publish)
                </h3>
                <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="件名 (Subject)"
                    value={publishSubject}
                    onChange={(e) => setPublishSubject(e.target.value)}
                    required
                  />
                  <textarea
                    rows={3}
                    placeholder="通知メッセージ本文"
                    value={publishMessage}
                    onChange={(e) => setPublishMessage(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={loading || !publishMessage} style={{ alignSelf: 'flex-start' }}>
                    トピックに発行してメール配信
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscriptions for the selected topic */}
      {selectedTopicArn && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👥 登録済みサブスクリプション ({subscriptions.length})
            </h3>
            <button className="btn-secondary" onClick={() => fetchSubscriptions(selectedTopicArn)}>
              🔄 更新
            </button>
          </div>

          <div className="item-list">
            {subscriptions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                サブスクリプションはまだ登録されていません。上のフォームからメールアドレスを登録してください。
              </p>
            ) : (
              subscriptions.map((s, idx) => (
                <div key={s.arn || idx} className="item-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="logo-badge" style={{ fontSize: '11px', padding: '2px 6px', background: s.protocol === 'email' ? '#10b981' : '#3b82f6' }}>
                        {s.protocol.toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 600 }}>{s.endpoint}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Subscription ARN: <code>{s.arn}</code>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Active</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
