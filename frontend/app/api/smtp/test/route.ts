import { NextRequest, NextResponse } from 'next/server';
import { safeReturnTo, withParam } from '../_shared';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// 保存済みの SMTP 設定で接続（＋認証）だけを試す。メールは送らない。
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const returnTo = safeReturnTo(form.get('return_to'));
  try {
    const res = await fetch(`${B}/api/smtp/test`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    const key = res.ok && d.ok ? 'msg' : 'err';
    const text = d.ok
      ? (d.mode === 'local' ? `🧪 接続テスト成功（擬似送信モード）: ${d.detail}` : `✅ SMTP接続テスト成功: ${d.detail}`)
      : `SMTP接続テスト失敗: ${d.detail || res.statusText}`;
    return NextResponse.redirect(new URL(withParam(returnTo, key, text), req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(withParam(returnTo, 'err', e.message), req.url), 303);
  }
}
