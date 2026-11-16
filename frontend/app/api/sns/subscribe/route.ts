import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const topic_arn = form.get('topic_arn') as string;
  const email = (form.get('email') as string || '').trim();
  const redirectTopic = form.get('redirect_topic') as string | null;
  const redirectPipeline = form.get('redirect_pipeline');
  const dest = redirectPipeline
    ? '/pipeline'
    : redirectTopic
    ? `/sns?topic=${encodeURIComponent(redirectTopic)}`
    : '/sns';

  try {
    const res = await fetch(`${B}/api/sns/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, protocol: 'email', endpoint: email }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`${dest}&err=${encodeURIComponent(d.detail || '登録失敗')}`, req.url));
    }
    return NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}msg=${encodeURIComponent(`${email} を登録しました`)}`, req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}err=${encodeURIComponent(e.message)}`, req.url));
  }
}
