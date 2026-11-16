import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const topic_arn = form.get('topic_arn') as string;
  const subject = (form.get('subject') as string || '').trim();
  const message = (form.get('message') as string || '').trim();
  const delivery_mode = form.get('delivery_mode') as string;
  if (delivery_mode !== 'local' && delivery_mode !== 'smtp') {
    return NextResponse.redirect(new URL(`/pipeline?err=${encodeURIComponent('送信方法（SMTP / 擬似送信）を選んでください')}`, req.url), 303);
  }

  try {
    const res = await fetch(`${B}/api/sns/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, subject, message, delivery_mode }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`/pipeline?err=${encodeURIComponent((typeof d.detail === "string" ? d.detail : "") || '配信失敗')}`, req.url), 303);
    }
    const d = await res.json().catch(() => ({}));
    const mails: { status?: string; to?: string; error?: string }[] = d.dispatched_emails || [];
    const failed = mails.filter(m => (m.status || '').startsWith('smtp_error'));
    const viaSmtp = mails.filter(m => (m.status || '').startsWith('delivered_smtp')).length;
    if (failed.length > 0) {
      const detail = `配信しましたが、メール ${failed.length}/${mails.length} 件の SMTP 送信に失敗しました: ${failed[0].error || failed[0].status}`;
      return NextResponse.redirect(new URL(`/pipeline?err=${encodeURIComponent(detail)}`, req.url), 303);
    }
    const msg = mails.length === 0
      ? 'ブロードキャストを配信しました（メールサブスクライバーなし）'
      : viaSmtp > 0
      ? `ブロードキャストを配信しました（メール ${viaSmtp} 件を SMTP で送信）`
      : `ブロードキャストを配信しました（メール ${mails.length} 件を擬似送信・Mailbox に記録）`;
    return NextResponse.redirect(new URL(`/pipeline?msg=${encodeURIComponent(msg)}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/pipeline?err=${encodeURIComponent(e.message)}`, req.url), 303);
  }
}
