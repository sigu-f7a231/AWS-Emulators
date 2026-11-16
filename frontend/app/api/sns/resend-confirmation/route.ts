import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// 承認待ちの購読に確認メールを再送（Pipeline / SNS 画面から）
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const subscription_arn = (form.get('subscription_arn') as string) || '';
  const returnTo = form.get('return_to') as string;
  const dest = returnTo && returnTo.startsWith('/sns') ? returnTo : '/pipeline';
  const back = (key: 'msg' | 'err', text: string) =>
    NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(text)}`, req.url), 303);
  const delivery_mode = form.get('delivery_mode') as string;
  if (delivery_mode !== 'local' && delivery_mode !== 'smtp') {
    return back('err', '送信方法（SMTP / 擬似送信）を選んでください');
  }
  try {
    const res = await fetch(`${B}/api/sns/subscriptions/${encodeURIComponent(subscription_arn)}/resend-confirmation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delivery_mode }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return back('err', typeof d.detail === 'string' ? d.detail : '再送に失敗しました');
    const to = d.confirmation_email?.to || '';
    const st: string = d.confirmation_email?.status || '';
    if (st.startsWith('smtp_error')) return back('err', `確認メールの SMTP 送信に失敗しました（Mailbox には記録）: ${d.confirmation_email?.error}`);
    const how = st.startsWith('delivered_smtp') ? 'SMTP で送信' : '擬似送信。Mailbox で確認';
    return back('msg', `確認メールを再送しました（${to ? `${to}、` : ''}${how}）。メール内のリンクで承認するまで配信されません`);
  } catch (e: any) {
    return back('err', e.message || '接続エラー');
  }
}
