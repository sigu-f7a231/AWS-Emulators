import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// email 購読の登録（SNS / Pipeline 画面から）。AWS と同じく承認待ちで作成され、確認メールが送られる
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const topic_arn = form.get('topic_arn') as string;
  const email = ((form.get('email') as string) || '').trim();
  const protocol = ((form.get('protocol') as string) || 'email').trim();
  const redirectTopic = form.get('redirect_topic') as string | null;
  const dest = form.get('redirect_pipeline')
    ? '/pipeline'
    : redirectTopic ? `/sns?topic=${encodeURIComponent(redirectTopic)}` : '/sns';
  const back = (key: 'msg' | 'err', text: string) =>
    NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(text)}`, req.url), 303);
  if (!topic_arn) return back('err', 'トピック ARN を選択してください');
  if (protocol !== 'email') return back('err', `プロトコル「${protocol}」は使えません（Eメールのみ）`);
  const delivery_mode = form.get('delivery_mode') as string;
  if (delivery_mode !== 'local' && delivery_mode !== 'smtp') {
    return back('err', '送信方法（SMTP / 擬似送信）を選んでください');
  }

  try {
    const res = await fetch(`${B}/api/sns/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, protocol, endpoint: email, delivery_mode }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return back('err', typeof d.detail === 'string' ? d.detail : '登録に失敗しました');
    if (d.status === 'confirmed') return back('msg', `${email} はすでに承認済みです`);
    const mailStatus: string = d.confirmation_email?.status || '';
    const how = mailStatus.startsWith('delivered_smtp') ? 'SMTP で送信'
      : mailStatus.startsWith('smtp_error') ? `SMTP 送信に失敗（${d.confirmation_email?.error}）。Mailbox に記録`
      : '擬似送信。Mailbox で確認';
    return back('msg', `${email} に確認メールを送りました（${how}）。メール内のリンクで承認するまで配信されません`);
  } catch (e: any) {
    return back('err', e.message || '接続エラー');
  }
}
