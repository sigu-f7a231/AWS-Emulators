import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const topic_arn = form.get('topic_arn') as string;
  const queue_url = form.get('queue_url') as string;
  const redirectPipeline = form.get('redirect_pipeline');
  const dest = redirectPipeline ? '/pipeline' : '/sns';

  try {
    const res = await fetch(`${B}/api/sns/subscribe-sqs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, queue_url }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`${dest}?err=${encodeURIComponent(d.detail || 'SQS紐付け失敗')}`, req.url));
    }
    return NextResponse.redirect(new URL(`${dest}?msg=${encodeURIComponent('SQSキューを紐付けました')}`, req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`${dest}?err=${encodeURIComponent(e.message)}`, req.url));
  }
}
