import { NextRequest, NextResponse } from 'next/server';
import { safeReturnTo, withParam } from '../_shared';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// SMTP 設定の保存（Mailbox / Pipeline 共通）
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const returnTo = safeReturnTo(form.get('return_to'));
  const str = (k: string) => ((form.get(k) as string) || '').trim();

  const payload = {
    smtp_host: str('smtp_host'),
    smtp_port: parseInt(str('smtp_port') || '587', 10) || 587,
    smtp_user: str('smtp_user'),
    // 空欄なら backend 側で保存済みのパスワードを維持する
    smtp_password: (form.get('smtp_password') as string) || '',
    smtp_from: str('smtp_from') || 'aws-emulator@local.test',
    is_enabled: form.get('is_enabled') === 'on',
    clear_password: form.get('clear_password') === 'on',
  };

  try {
    const res = await fetch(`${B}/api/smtp/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const detail = typeof d.detail === 'string' ? d.detail : 'SMTP設定の保存に失敗しました';
      return NextResponse.redirect(new URL(withParam(returnTo, 'err', detail), req.url), 303);
    }
    const msg = payload.is_enabled && payload.smtp_host
      ? `SMTP設定を保存しました（実メール送信: ON / ${payload.smtp_host}:${payload.smtp_port}）`
      : 'SMTP設定を保存しました（実メール送信: OFF / 擬似送信モード）';
    return NextResponse.redirect(new URL(withParam(returnTo, 'msg', msg), req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(withParam(returnTo, 'err', e.message), req.url), 303);
  }
}
