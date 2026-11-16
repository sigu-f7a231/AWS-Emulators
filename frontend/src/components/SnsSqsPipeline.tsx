import React, { useState, useEffect } from 'react';

interface Topic {
  arn: string;
  name: string;
}

interface Queue {
  name: string;
  url: string;
}

interface EmailSub {
  subscription_arn: string;
  email: string;
}

interface SqsSub {
  subscription_arn: string;
  queue_name: string;
  queue_arn: string;
}

interface TopicPipeline {
  topic_arn: string;
  topic_name: string;
  email_subscriptions: EmailSub[];
  sqs_subscriptions: SqsSub[];
}

interface EmailDeliveryResult {
  email: string;
  email_id?: string;
  status: string;
  error?: string;
}

interface SqsDeliveryResult {
  queue_name: string;
  queue_arn: string;
  sqs_message_id?: string;
  status: string;
}

export const SnsSqsPipeline: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [pipelines, setPipelines] = useState<TopicPipeline[]>([]);

  // Selected topic for broadcasting
  const [selectedBroadcastTopicArn, setSelectedBroadcastTopicArn] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('【重要】システム通知');
  const [broadcastMessage, setBroadcastMessage] = useState(
    'SNSトピックから発行され、登録されたサブスクリプション（メールアドレス & SQSキュー）宛てに配信されたメッセージです。'
  );

  // Quick resource creation
  const [newTopicName, setNewTopicName] = useState('');
  const [newQueueName, setNewQueueName] = useState('');
  const [showResourceForms, setShowResourceForms] = useState(false);

  // Per-topic inline add forms
  const [activeAddEmailTopic, setActiveAddEmailTopic] = useState<string | null>(null);
  const [inputEmail, setInputEmail] = useState('');

  const [activeAddSqsTopic, setActiveAddSqsTopic] = useState<string | null>(null);
  const [inputQueueName, setInputQueueName] = useState('');

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);
  const [recentBroadcastResult, setRecentBroadcastResult] = useState<{
    message_id: string;
    email_deliveries: EmailDeliveryResult[];
    sqs_deliveries: SqsDeliveryResult[];
  } | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/pipeline/overview');
      const data = await res.json();
      if (res.ok) {
        setTopics(data.topics || []);
        setQueues(data.queues || []);
        setPipelines(data.pipelines || []);

        if (data.topics?.length > 0 && !selectedBroadcastTopicArn) {
          setSelectedBroadcastTopicArn(data.topics[0].arn);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // Quick Create Topic
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sns/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_name: newTopicName }),
      });
      if (res.ok) {
        setNewTopicName('');
        await fetchOverview();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Quick Create Queue
  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sqs/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue_name: newQueueName }),
      });
      if (res.ok) {
        setNewQueueName('');
        await fetchOverview();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Add Email Subscription to Topic
  const handleAddEmailSubscription = async (topicArn: string) => {
    if (!inputEmail) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/pipeline/subscribe-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_arn: topicArn, email: inputEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: `✔ SNSトピックにメールアドレス '${inputEmail}' を登録しました！`, isError: false });
        setInputEmail('');
        setActiveAddEmailTopic(null);
        await fetchOverview();
      } else {
        setNotification({ text: data.detail || '登録に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Add SQS Subscription to Topic
  const handleAddSqsSubscription = async (topicArn: string) => {
    if (!inputQueueName) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/pipeline/subscribe-sqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_arn: topicArn, queue_name: inputQueueName }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: `✔ SNSトピックにSQSキュー '${inputQueueName}' を紐付けました！`, isError: false });
        setInputQueueName('');
        setActiveAddSqsTopic(null);
        await fetchOverview();
      } else {
        setNotification({ text: data.detail || '紐付けに失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Remove Subscription (Unsubscribe)
  const handleRemoveSubscription = async (subArn: string, label: string) => {
    if (!confirm(`サブスクリプション '${label}' を解除・削除しますか？`)) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/pipeline/subscriptions/${encodeURIComponent(subArn)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ text: `✔ サブスクリプション '${label}' を解除しました`, isError: false });
        await fetchOverview();
      } else {
        setNotification({ text: data.detail || '解除に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Broadcast
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBroadcastTopicArn || !broadcastMessage) return;
    setLoading(true);
    setNotification(null);
    setRecentBroadcastResult(null);

    try {
      const res = await fetch('/api/pipeline/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_arn: selectedBroadcastTopicArn,
          subject: broadcastSubject,
          message: broadcastMessage,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const result = data.result;
        setRecentBroadcastResult(result);
        const emailCount = result?.email_deliveries?.length || 0;
        const sqsCount = result?.sqs_deliveries?.length || 0;
        setNotification({
          text: `🎉 SNSトピックから発行し、登録済みメール ${emailCount} 件宛てに送信、連携SQS ${sqsCount} 件へ配送を完了しました！`,
          isError: false,
        });
      } else {
        setNotification({ text: data.detail || '配信に失敗しました', isError: true });
      }
    } catch (e: any) {
      setNotification({ text: e.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Current selected pipeline details
  const currentPipeline = pipelines.find((p) => p.topic_arn === selectedBroadcastTopicArn);

  return (
    <div>
      {/* Visual Pipeline Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))', borderColor: 'var(--aws-orange)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title" style={{ color: 'var(--aws-orange)', margin: 0 }}>
              🚀 SNS ➜ SQS 連携メール配信パイプライン
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
              <strong>メールアドレスは SNS のサブスクリプションとして登録・管理します。</strong>
              トピックにメッセージを発行すると、登録されたすべてのメールアドレスへ一斉配信され、紐付いた SQS キューにも自動配送されます。
            </p>
          </div>

          <button
            className="btn-secondary"
            onClick={() => setShowResourceForms(!showResourceForms)}
            style={{ fontSize: '12px', borderColor: 'var(--aws-orange)' }}
          >
            {showResourceForms ? '閉じる ✕' : '＋ 新規トピック・キュー作成'}
          </button>
        </div>

        {/* Quick Resource Creation Bar */}
        {showResourceForms && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <form onSubmit={handleCreateTopic} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                placeholder="新規トピック名 (例: system-alerts)"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
              />
              <button type="submit" className="btn-secondary" disabled={loading || !newTopicName}>
                ＋ トピック作成
              </button>
            </form>
            <form onSubmit={handleCreateQueue} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                placeholder="新規キュー名 (例: email-backup-queue)"
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
              />
              <button type="submit" className="btn-secondary" disabled={loading || !newQueueName}>
                ＋ キュー作成
              </button>
            </form>
          </div>
        )}
      </div>

      {notification && (
        <div className={`alert-message ${notification.isError ? 'alert-error' : 'alert-success'}`}>
          {notification.text}
        </div>
      )}

      {/* Main Broadcast Box (配信ボタン) */}
      <div className="card" style={{ borderColor: 'var(--aws-orange)', backgroundColor: 'rgba(255, 153, 0, 0.05)' }}>
        <h2 className="card-title" style={{ fontSize: '18px', color: 'var(--aws-orange)' }}>
          📢 配信メッセージ作成 & 配信ボタン
        </h2>

        {topics.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '14px' }}>
            ⚠️ まずトピックを作成してください（上の「＋ 新規トピック・キュー作成」からすぐに作成できます）。
          </div>
        ) : (
          <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                配信対象の SNS トピック:
              </label>
              <select
                value={selectedBroadcastTopicArn}
                onChange={(e) => setSelectedBroadcastTopicArn(e.target.value)}
                style={{ width: '100%' }}
              >
                {topics.map((t) => (
                  <option key={t.arn} value={t.arn}>
                    📢 {t.name} ({t.arn})
                  </option>
                ))}
              </select>

              {/* Real-time preview of who will receive this broadcast */}
              {currentPipeline && (
                <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>このトピックの配信先:</span>
                  {currentPipeline.email_subscriptions.length === 0 ? (
                    <span style={{ color: '#f87171' }}>⚠️ メールアドレスが未登録です（下のパイプラインで追加できます）</span>
                  ) : (
                    currentPipeline.email_subscriptions.map((es) => (
                      <span key={es.subscription_arn} className="logo-badge" style={{ background: '#10b981', fontSize: '11px', padding: '2px 8px' }}>
                        📧 {es.email}
                      </span>
                    ))
                  )}

                  {currentPipeline.sqs_subscriptions.map((ss) => (
                    <span key={ss.subscription_arn} className="logo-badge" style={{ background: '#8b5cf6', fontSize: '11px', padding: '2px 8px' }}>
                      📬 SQS: {ss.queue_name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                メール件名 (Subject):
              </label>
              <input
                type="text"
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                特定の配信メッセージ本文:
              </label>
              <textarea
                rows={3}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !selectedBroadcastTopicArn}
                style={{
                  fontSize: '16px',
                  padding: '12px 32px',
                  background: 'linear-gradient(135deg, #ff9900, #ff5722)',
                  boxShadow: '0 4px 14px rgba(255, 153, 0, 0.4)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '配信処理中...' : '🚀 メールを配信する (Publish & Deliver)'}
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                ※ トピックに登録されたすべてのメールアドレス宛てに送信されます。
              </span>
            </div>
          </form>
        )}

        {/* Real-time Delivery Result Feedback */}
        {recentBroadcastResult && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '15px', color: '#34d399', marginBottom: '10px' }}>
              ✔ 配信結果詳細 (SNS Message ID: <code>{recentBroadcastResult.message_id}</code>)
            </h4>

            {/* Email Deliveries */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>メール配信結果:</span>
              {recentBroadcastResult.email_deliveries.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#f87171', margin: '4px 0' }}>
                  登録されたメールサブスクリプションがありませんでした。下のトピックカードからメールアドレスを追加してください。
                </p>
              ) : (
                recentBroadcastResult.email_deliveries.map((ed, i) => (
                  <div key={i} style={{ fontSize: '13px', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📧 宛先: <strong style={{ color: 'var(--aws-orange)' }}>{ed.email}</strong></span>
                    <span style={{ color: ed.status.startsWith('delivered') ? '#34d399' : '#f87171', fontWeight: 600 }}>
                      [{ed.status}]
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* SQS Deliveries */}
            {recentBroadcastResult.sqs_deliveries.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>SQS配送結果:</span>
                {recentBroadcastResult.sqs_deliveries.map((sd, i) => (
                  <div key={i} style={{ fontSize: '13px', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📬 SQSキュー: <strong>{sd.queue_name}</strong></span>
                    <span style={{ color: '#8b5cf6', fontWeight: 600 }}>[{sd.status}]</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Structured Pipeline Management: Topics with Email and SQS Subscriptions */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              🔗 構築済みパイプライン一覧 ＆ サブスクリプション変更設定
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              各SNSトピックに対するメールアドレス（SNSサブスクリプション）の追加・変更・解除、およびSQSキューの連携・変更がここで行えます。
            </p>
          </div>
          <button className="btn-secondary" onClick={fetchOverview}>🔄 更新</button>
        </div>

        {pipelines.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            トピックがまだありません。上のボタンから作成してください。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {pipelines.map((pipe) => (
              <div
                key={pipe.topic_arn}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '18px',
                }}
              >
                {/* Topic Title Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>📢</span>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                        SNS トピック: <span style={{ color: 'var(--aws-orange)' }}>{pipe.topic_name}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                        {pipe.topic_arn}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn-secondary"
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      setSelectedBroadcastTopicArn(pipe.topic_arn);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    このトピックを配信対象に選択 ➔
                  </button>
                </div>

                <div className="grid-2">
                  {/* Email Subscriptions Section (ここでのみメールを追加・変更・削除) */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📧 登録メールアドレス (SNSサブスクリプション) ({pipe.email_subscriptions.length})
                      </span>
                      <button
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--aws-orange)', borderColor: 'var(--aws-orange)' }}
                        onClick={() => {
                          setActiveAddEmailTopic(activeAddEmailTopic === pipe.topic_arn ? null : pipe.topic_arn);
                          setInputEmail('');
                        }}
                      >
                        {activeAddEmailTopic === pipe.topic_arn ? 'キャンセル' : '＋ メール追加'}
                      </button>
                    </div>

                    {/* Inline Add Email Form */}
                    {activeAddEmailTopic === pipe.topic_arn && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                        <input
                          type="email"
                          placeholder="追加するメールアドレス (例: admin@example.com)"
                          value={inputEmail}
                          onChange={(e) => setInputEmail(e.target.value)}
                          autoFocus
                          style={{ fontSize: '13px' }}
                        />
                        <button
                          className="btn-primary"
                          style={{ fontSize: '12px', padding: '6px 14px' }}
                          onClick={() => handleAddEmailSubscription(pipe.topic_arn)}
                          disabled={loading || !inputEmail}
                        >
                          登録
                        </button>
                      </div>
                    )}

                    {/* List of Email Subscriptions */}
                    {pipe.email_subscriptions.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        メールアドレスは登録されていません。「＋ メール追加」から登録してください。
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pipe.email_subscriptions.map((es) => (
                          <div
                            key={es.subscription_arn}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'rgba(255,255,255,0.04)',
                              borderRadius: '6px',
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>✉️ {es.email}</span>
                            <button
                              className="btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }}
                              onClick={() => handleRemoveSubscription(es.subscription_arn, es.email)}
                            >
                              解除 (削除)
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SQS Subscriptions Section */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📬 連携 SQS キュー (SNSサブスクリプション) ({pipe.sqs_subscriptions.length})
                      </span>
                      <button
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--aws-orange)', borderColor: 'var(--aws-orange)' }}
                        onClick={() => {
                          setActiveAddSqsTopic(activeAddSqsTopic === pipe.topic_arn ? null : pipe.topic_arn);
                          if (queues.length > 0) setInputQueueName(queues[0].name);
                        }}
                      >
                        {activeAddSqsTopic === pipe.topic_arn ? 'キャンセル' : '＋ SQS連携'}
                      </button>
                    </div>

                    {/* Inline Add SQS Form */}
                    {activeAddSqsTopic === pipe.topic_arn && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                        <select
                          value={inputQueueName}
                          onChange={(e) => setInputQueueName(e.target.value)}
                          style={{ fontSize: '13px', flex: 1 }}
                        >
                          {queues.length === 0 && <option value="">キューがありません</option>}
                          {queues.map((q) => (
                            <option key={q.name} value={q.name}>
                              ✉️ {q.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn-primary"
                          style={{ fontSize: '12px', padding: '6px 14px' }}
                          onClick={() => handleAddSqsSubscription(pipe.topic_arn)}
                          disabled={loading || !inputQueueName}
                        >
                          連携
                        </button>
                      </div>
                    )}

                    {/* List of SQS Subscriptions */}
                    {pipe.sqs_subscriptions.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        連携中のSQSキューはありません。「＋ SQS連携」から選択してください。
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pipe.sqs_subscriptions.map((ss) => (
                          <div
                            key={ss.subscription_arn}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'rgba(255,255,255,0.04)',
                              borderRadius: '6px',
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>📬 {ss.queue_name}</span>
                            <button
                              className="btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444' }}
                              onClick={() => handleRemoveSubscription(ss.subscription_arn, ss.queue_name)}
                            >
                              解除 (削除)
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
