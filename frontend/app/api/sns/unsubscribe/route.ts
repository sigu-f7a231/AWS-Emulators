import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// 配信停止リンクからの購読解除
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const subscription_arn = (form.get('subscription_arn') as string) || '';
  const token = (form.get('token') as string) || '';
  const page = (q: Record<string, string>) =>
    NextResponse.redirect(new URL(`/sns/unsubscribe?${new URLSearchParams({ SubscriptionArn: subscription_arn, Token: token, ...q })}`, req.url), 303);
  try {
    const res = await fetch(`${B}/api/sns/unsubscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_arn, token }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return page({ err: typeof d.detail === 'string' ? d.detail : '配信停止に失敗しました' });
    }
    return page({ done: '1' });
  } catch (e: any) {
    return page({ err: e.message || '接続エラー' });
  }
}
