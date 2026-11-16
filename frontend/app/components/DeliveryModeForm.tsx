'use client';
// 送信方法（SMTP / 擬似送信）を選べる送信フォーム。
// SMTP を選んだのに SMTP が未設定（または無効）なら、その場でフォーム上部にエラーを出し、送信ボタンを押せなくする。
// ※ 最終的な判定はサーバー側（Next.js の route と Python バックエンド）でも行う。
import { useState } from 'react';

export type DeliveryMode = 'local' | 'smtp';

export default function DeliveryModeForm({
  action, smtpReady, smtpLabel, submitLabel, children, label = '送信方法',
}: {
  action: string;
  smtpReady: boolean;
  smtpLabel?: string;          // 例: smtp.gmail.com:587
  submitLabel: string;
  children: React.ReactNode;   // 宛先・件名・本文などの入力欄（サーバー側で描画）
  label?: string;              // 例: 「確認メールの送信方法」
}) {
  const [mode, setMode] = useState<DeliveryMode>(smtpReady ? 'smtp' : 'local');
  const blocked = mode === 'smtp' && !smtpReady;

  const option = (value: DeliveryMode, title: string, sub: string) => (
    <label style={{
      flex: 1, minWidth: '200px', display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer',
      padding: '10px 12px', borderRadius: '8px',
      border: `1px solid ${mode === value ? 'var(--aws-orange)' : 'var(--border-color)'}`,
      backgroundColor: mode === value ? 'rgba(255,153,0,0.08)' : 'var(--bg-primary)',
    }}>
      <input type="radio" name="delivery_mode" value={value} checked={mode === value}
        onChange={() => setMode(value)} style={{ flex: 'none', width: '16px', height: '16px', marginTop: '2px' }} />
      <span>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: '#fff' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</span>
      </span>
    </label>
  );

  return (
    <form
      method="POST"
      action={action}
      onSubmit={(e) => { if (blocked) e.preventDefault(); }}
    >
      {blocked && (
        <div className="alert-message alert-error" role="alert">
          ⚠️ SMTP が設定されていません（または無効です）。このままでは送信できません。
          <a href="#smtp" style={{ color: '#fff', marginLeft: '6px' }}>SMTP 設定へ</a>
          　または「擬似送信」を選んでください。
        </div>
      )}

      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {option('smtp', '🌐 SMTP で送信',
          smtpReady ? `実際にメールを送ります（${smtpLabel || 'SMTP'}）` : '未設定のため使えません')}
        {option('local', '🧪 擬似送信', '外部には送らず、送信済みとして Mailbox に記録します')}
      </div>

      {children}

      <button type="submit" className="btn-primary" disabled={blocked}
        title={blocked ? 'SMTP が未設定のため送信できません' : undefined}>
        {submitLabel}
      </button>
    </form>
  );
}
