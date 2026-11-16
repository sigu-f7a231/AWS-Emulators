import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const queue_name = (form.get('queue_name') as string || '').trim();
  const redirectPipeline = form.get('redirect_pipeline');
  const dest = redirectPipeline ? '/pipeline' : '/sqs';

  try {
    const res = await fetch(`${B}/api/sqs/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`${dest}?err=${encodeURIComponent(d.detail || '作成失敗')}`, req.url));
    }
    return NextResponse.redirect(new URL(`${dest}?msg=${encodeURIComponent(`キュー "${queue_name}" を作成しました`)}`, req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`${dest}?err=${encodeURIComponent(e.message)}`, req.url));
  }
}
