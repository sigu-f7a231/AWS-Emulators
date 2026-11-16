import React, { useState, useEffect } from 'react';
import { apiInspector, ApiCallLog } from '../../services/apiInspector.ts';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { CodeViewer } from './CodeViewer.tsx';

export const ApiInspectorDrawer: React.FC = () => {
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ApiCallLog | null>(null);

  useEffect(() => {
    const unsub = apiInspector.subscribe((newLogs) => {
      setLogs(newLogs);
      if (newLogs.length > 0 && !selectedLog) {
        setSelectedLog(newLogs[0]);
      }
    });
    return unsub;
  }, []);

  const getServiceBadgeVariant = (service: string) => {
    switch (service) {
      case 'S3': return 'green';
      case 'SQS': return 'purple';
      case 'SNS': return 'blue';
      case 'DynamoDB': return 'orange';
      default: return 'gray';
    }
  };

  return (
    <aside style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
      {/* Drawer Toggle Bar */}
      <div
        style={{
          background: 'linear-gradient(90deg, #1e293b, #0f172a)',
          borderTop: '2px solid var(--aws-orange)',
          padding: '8px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.5)',
          cursor: 'pointer',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '15px' }}>🔍</span>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--aws-orange)' }}>
            AWS API & SDK Inspector
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            (エミュレータの通信・リクエスト・レスポンス透過ビューア)
          </span>
          {logs.length > 0 && (
            <Badge variant="blue" size="sm">
              最新: {logs[0].action} ({logs[0].executionTimeMs}ms)
            </Badge>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            履歴: {logs.length}件
          </span>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); apiInspector.clear(); }}>
            クリア
          </Button>
          <span style={{ fontSize: '14px', color: 'var(--aws-orange)' }}>
            {isOpen ? '▼ 閉じる' : '▲ 詳細を開く'}
          </span>
        </div>
      </div>

      {/* Expanded Drawer Content */}
      {isOpen && (
        <div
          style={{
            height: '320px',
            backgroundColor: '#090d16',
            borderTop: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: '360px 1fr',
            overflow: 'hidden',
          }}
        >
          {/* Logs List Sidebar */}
          <div style={{ borderRight: '1px solid var(--border-color)', overflowY: 'auto', padding: '8px' }}>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '16px' }}>
                まだ API 呼び出しが記録されていません。画面上で操作するとここにリアルタイム記録されます。
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    backgroundColor: selectedLog?.id === log.id ? 'rgba(255,153,0,0.15)' : 'transparent',
                    border: selectedLog?.id === log.id ? '1px solid var(--aws-orange)' : '1px solid transparent',
                  }}
                  onClick={() => setSelectedLog(log)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Badge variant={getServiceBadgeVariant(log.service) as any} size="sm">
                        {log.service}
                      </Badge>
                      <span style={{ fontWeight: 600, fontSize: '12px', color: '#fff' }}>
                        {log.action}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: log.status === 'success' ? '#34d399' : '#f87171' }}>
                      {log.executionTimeMs}ms
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {log.timestamp}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected Log Inspector Detail */}
          <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedLog ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '14px', margin: 0, color: '#fff' }}>
                      API コール: <code>{selectedLog.action}</code>
                    </h3>
                    <Badge variant={selectedLog.status === 'success' ? 'green' : 'red'}>
                      {selectedLog.status.toUpperCase()}
                    </Badge>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    時刻: {selectedLog.timestamp} | 所要時間: {selectedLog.executionTimeMs}ms
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      📤 送信パラメータ (Request Payload)
                    </h4>
                    <CodeViewer
                      code={selectedLog.requestParams || { message: 'パラメータなし (GET / Empty)' }}
                      maxHeight="180px"
                    />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      📥 エミュレータ応答 (Response Payload)
                    </h4>
                    <CodeViewer
                      code={selectedLog.responseSummary || { message: 'レスポンスなし' }}
                      maxHeight="180px"
                    />
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                左側のリストから確認したい API コールを選択してください。
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
