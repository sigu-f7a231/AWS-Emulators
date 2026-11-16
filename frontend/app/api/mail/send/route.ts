import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const to = (form.get('to') as string || '').trim();
  const subject = (form.get('subject') as string || '').trim();
  const body = (form.get('body') as string || '').trim();
  const delivery_mode = form.get('delivery_mode') as string;
  if (delivery_mode !== 'local' && delivery_mode !== 'smtp') {
    return NextResponse.redirect(new URL(`/mailbox?err=${encodeURIComponent('送信方法（SMTP / 擬似送信）を選んでください')}`, req.url), 303);
  }

  try {
    const res = await fetch(`${B}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body, delivery_mode }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`/mailbox?err=${encodeURIComponent((typeof d.detail === "string" ? d.detail : "") || '送信失敗')}`, req.url), 303);
    }
    const d = await res.json().catch(() => ({}));
    const status: string = d.email?.status || '';
    if (status.startsWith('smtp_error')) {
      return NextResponse.redirect(new URL(`/mailbox?err=${encodeURIComponent(`Mailbox には記録しましたが、SMTP 送信に失敗しました: ${d.email?.error || status}`)}`, req.url), 303);
    }
    const msg = status.startsWith('delivered_smtp') ? `メールを SMTP で送信しました（${to}）` : `メールを送信しました（擬似送信: ${to} 宛て。外部には送らず Mailbox に記録）`;
    return NextResponse.redirect(new URL(`/mailbox?msg=${encodeURIComponent(msg)}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/mailbox?err=${encodeURIComponent(e.message)}`, req.url), 303);
  }
}
