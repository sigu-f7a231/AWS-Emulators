import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// パイプライン一覧からの購読解除（Unsubscribe）。Eメール / SQS どちらも
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const subscription_arn = ((form.get('subscription_arn') as string) || '').trim();
  const label = ((form.get('label') as string) || '').trim();
  const back = (key: 'msg' | 'err', text: string) =>
    NextResponse.redirect(new URL(`/pipeline?${key}=${encodeURIComponent(text)}`, req.url), 303);
  if (!subscription_arn) return back('err', '解除するサブスクリプションが指定されていません');
  try {
    const res = await fetch(`${B}/api/pipeline/subscriptions/${encodeURIComponent(subscription_arn)}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return back('err', typeof d.detail === 'string' ? d.detail : '解除に失敗しました');
    }
    return back('msg', `${label || 'サブスクリプション'} の紐付けを解除しました`);
  } catch (e: any) {
    return back('err', e.message || '接続エラー');
  }
}
