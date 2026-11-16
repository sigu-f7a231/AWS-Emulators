import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const topic_arn = form.get('topic_arn') as string;
  const subject = (form.get('subject') as string || '').trim();
  const message = (form.get('message') as string || '').trim();
  const redirectTopic = form.get('redirect_topic') as string | null;
  const dest = redirectTopic
    ? `/sns?topic=${encodeURIComponent(redirectTopic)}`
    : '/pipeline';

  try {
    const res = await fetch(`${B}/api/sns/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, subject, message }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`${dest}&err=${encodeURIComponent(d.detail || '配信失敗')}`, req.url));
    }
    return NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}msg=${encodeURIComponent('メッセージを配信しました')}`, req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}err=${encodeURIComponent(e.message)}`, req.url));
  }
}
