import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// SNS 画面からのメッセージ発行
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const topic_arn = form.get('topic_arn') as string;
  const subject = ((form.get('subject') as string) || '').trim();
  const message = ((form.get('message') as string) || '').trim();
  const message_group_id = ((form.get('message_group_id') as string) || '').trim() || null;
  const message_deduplication_id = ((form.get('message_deduplication_id') as string) || '').trim() || null;
  const redirectTopic = form.get('redirect_topic') as string | null;
  const dest = redirectTopic ? `/sns?topic=${encodeURIComponent(redirectTopic)}` : '/pipeline';
  const back = (key: 'msg' | 'err', text: string) =>
    NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(text)}`, req.url), 303);
  const delivery_mode = form.get('delivery_mode') as string;
  if (delivery_mode !== 'local' && delivery_mode !== 'smtp') {
    return back('err', '送信方法（SMTP / 擬似送信）を選んでください');
  }

  try {
    const res = await fetch(`${B}/api/sns/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_arn, subject, message, delivery_mode, message_group_id, message_deduplication_id }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return back('err', typeof d.detail === 'string' ? d.detail : '配信に失敗しました');
    const mails: { status?: string; error?: string }[] = d.dispatched_emails || [];
    const failed = mails.filter(m => (m.status || '').startsWith('smtp_error'));
    if (failed.length) return back('err', `発行しましたが、メール ${failed.length}/${mails.length} 件の SMTP 送信に失敗しました: ${failed[0].error}`);
    const sent = mails.length;
    const pending = (d.skipped_pending || []).length;
    return back('msg', `メッセージを発行しました（メール ${sent} 件${pending ? `、承認待ち ${pending} 件には送っていません` : ''}）`);
  } catch (e: any) {
    return back('err', e.message || '接続エラー');
  }
}
