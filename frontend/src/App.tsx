import { useState, useEffect } from 'react';
import { SnsSqsPipeline } from './components/SnsSqsPipeline.tsx';
import { S3Manager } from './components/S3Manager.tsx';
import { SqsManager } from './components/SqsManager.tsx';
import { SnsManager } from './components/SnsManager.tsx';
import { MailboxManager } from './components/MailboxManager.tsx';
import { DynamoDbManager } from './components/DynamoDbManager.tsx';
import { ApiInspectorDrawer } from './components/ui/ApiInspectorDrawer.tsx';
import { Badge } from './components/ui/Badge.tsx';
import { Button } from './components/ui/Button.tsx';
import { Card, CardHeader, CardTitle, CardDescription } from './components/ui/Card.tsx';

interface ConnectionStatus {
  status: 'connected' | 'error' | 'loading';
  endpoint?: string;
  region?: string;
  error?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'dynamodb' | 's3' | 'sqs' | 'sns' | 'mailbox' | 'guide'>('dynamodb');
  const [status, setStatus] = useState<ConnectionStatus>({ status: 'loading' });

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (res.ok && data.status === 'connected') {
        setStatus({
          status: 'connected',
          endpoint: data.endpoint,
          region: data.region,
        });
      } else {
        setStatus({
          status: 'error',
          endpoint: data.endpoint,
          error: data.error || 'Connection failed',
        });
      }
    } catch (e: any) {
      setStatus({ status: 'error', error: e.message });
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container" style={{ paddingBottom: '70px' }}>
      {/* Header */}
      <header className="header" style={{ marginBottom: '20px' }}>
        <div className="header-title">
          <span className="logo-badge">AWS</span>
          <h1 style={{ fontSize: '18px', margin: 0 }}>AWS Emulator Console</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            (ローカル完全再現 & API インスペクター搭載)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {status.status === 'connected' ? (
            <Badge variant="green" size="md">
              🟢 Connected ({status.region || 'us-east-1'})
            </Badge>
          ) : status.status === 'loading' ? (
            <Badge variant="gray" size="md">
              ⏳ Connecting...
            </Badge>
          ) : (
            <Badge variant="red" size="md">
              🔴 Disconnected
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={checkStatus} title="接続状態を再チェック">
            🔄
          </Button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <button
          className={`tab-button ${activeTab === 'dynamodb' ? 'active' : ''}`}
          onClick={() => setActiveTab('dynamodb')}
          style={{ fontWeight: 700 }}
        >
          ⚡ DynamoDB (型編集対応)
        </button>
        <button
          className={`tab-button ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          🚀 SNS×SQSメール配信
        </button>
        <button
          className={`tab-button ${activeTab === 's3' ? 'active' : ''}`}
          onClick={() => setActiveTab('s3')}
        >
          🪣 Amazon S3
        </button>
        <button
          className={`tab-button ${activeTab === 'sqs' ? 'active' : ''}`}
          onClick={() => setActiveTab('sqs')}
        >
          📬 Amazon SQS
        </button>
        <button
          className={`tab-button ${activeTab === 'sns' ? 'active' : ''}`}
          onClick={() => setActiveTab('sns')}
        >
          📢 Amazon SNS
        </button>
        <button
          className={`tab-button ${activeTab === 'mailbox' ? 'active' : ''}`}
          onClick={() => setActiveTab('mailbox')}
        >
          📧 送信メール履歴
        </button>
        <button
          className={`tab-button ${activeTab === 'guide' ? 'active' : ''}`}
          onClick={() => setActiveTab('guide')}
        >
          📖 SDK ガイド
        </button>
      </nav>

      {/* Main Content Area */}
      <main>
        {activeTab === 'dynamodb' && <DynamoDbManager />}
        {activeTab === 'pipeline' && <SnsSqsPipeline />}
        {activeTab === 's3' && <S3Manager />}
        {activeTab === 'sqs' && <SqsManager />}
        {activeTab === 'sns' && <SnsManager />}
        {activeTab === 'mailbox' && <MailboxManager />}
        {activeTab === 'guide' && (
          <Card>
            <CardHeader>
              <CardTitle icon="📖">AWS Emulator 開発・アーキテクチャガイド</CardTitle>
            </CardHeader>
            <CardDescription>
              各サービスがローカルエミュレータに対してどのように API コールを発行し、データをやり取りしているかを解説します。
            </CardDescription>

            <h3 style={{ fontSize: '15px', color: 'var(--aws-orange)', marginTop: '16px', marginBottom: '8px' }}>
              1. 🔍 画面下部の「AWS API Inspector」について
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              画面最下部にある <strong>「AWS API & SDK Inspector」</strong> バーをクリックすると、画面上で実行されたすべての操作（S3のListBuckets/PutObject、DynamoDBのCreateTable/PutItem、SNSのPublishなど）がどのようなリクエストJSONで送信され、エミュレータからどんなレスポンスが返ってきたかをリアルタイムで確認できます。
            </p>

            <h3 style={{ fontSize: '15px', color: 'var(--aws-orange)', marginTop: '20px', marginBottom: '8px' }}>
              2. ⚡ DynamoDB のデータ型について
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              DynamoDB では、アイテムの属性ごとに厳密な型（<code>S</code>: 文字列, <code>N</code>: 数値, <code>BOOL</code>: 真偽値, <code>L</code>: リスト, <code>M</code>: マップ）が割り振られます。「⚡ DynamoDB」タブのアイテムエディタでは、保存後でも自由に対象属性のデータ型を変更して更新（PutItem）することが可能です。
            </p>

            <h3 style={{ fontSize: '15px', color: 'var(--aws-orange)', marginTop: '20px', marginBottom: '8px' }}>
              3. ホストマシンの AWS CLI から接続する場合
            </h3>
            <div className="code-box">
              <pre>{`export AWS_ENDPOINT_URL=https://127.0.0.1:9297
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=emulator
export AWS_SECRET_ACCESS_KEY=emulator
export AWS_EC2_METADATA_DISABLED=true
export AWS_DISABLE_HOST_PREFIX_INJECTION=true

# DynamoDB テーブル一覧
aws dynamodb list-tables --no-verify-ssl

# S3 バケット一覧
aws s3 ls --no-verify-ssl`}</pre>
            </div>
          </Card>
        )}
      </main>

      {/* Real-time AWS API & SDK Inspector Drawer (Always accessible at bottom) */}
      <ApiInspectorDrawer />
    </div>
  );
}
