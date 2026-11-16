import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const queue_url = form.get('queue_url') as string;
  const message_body = (form.get('message_body') as string || '').trim();
  const redirectQueue = form.get('redirect_queue') as string | null;
  const dest = redirectQueue
    ? `/sqs?queue=${encodeURIComponent(redirectQueue)}`
    : '/sqs';

  try {
    const res = await fetch(`${B}/api/sqs/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_url, message_body }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`${dest}&err=${encodeURIComponent(d.detail || '送信失敗')}`, req.url));
    }
    return NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}msg=${encodeURIComponent('メッセージを送信しました')}`, req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}err=${encodeURIComponent(e.message)}`, req.url));
  }
}
