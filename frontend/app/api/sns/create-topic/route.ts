import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const topic_name = (form.get('topic_name') as string || '').trim();
  const topic_type = form.get('topic_type') === 'fifo' ? 'fifo' : 'standard';
  const display_name = ((form.get('display_name') as string) || '').trim() || null;
  const content_based_deduplication = form.get('content_based_deduplication') === 'on';
  const redirectPipeline = form.get('redirect_pipeline');
  const dest = redirectPipeline ? '/pipeline' : '/sns';

  try {
    const res = await fetch(`${B}/api/sns/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_name, topic_type, display_name, content_based_deduplication }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`${dest}?err=${encodeURIComponent(typeof d.detail === 'string' ? d.detail : '作成失敗')}`, req.url), 303);
    }
    const d = await res.json().catch(() => ({}));
    const created = d.name || topic_name;
    if (!redirectPipeline && d.topic_arn) {
      // AWS コンソールと同じく、作成したトピックの画面へ（続けてサブスクリプションを作成できる）
      return NextResponse.redirect(new URL(`/sns?topic=${encodeURIComponent(d.topic_arn)}&msg=${encodeURIComponent(`トピック "${created}" を作成しました。続けてサブスクリプションを作成できます`)}`, req.url), 303);
    }
    return NextResponse.redirect(new URL(`${dest}?msg=${encodeURIComponent(`トピック "${topic_name}" を作成しました`)}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`${dest}?err=${encodeURIComponent(e.message)}`, req.url), 303);
  }
}
