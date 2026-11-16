import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const bucket_name = form.get('bucket_name') as string;
  const object_key = (form.get('object_key') as string || '').trim();
  const object_content = (form.get('object_content') as string || '');

  try {
    const res = await fetch(`${B}/api/s3/objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket_name, object_key, content: object_content }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`/s3?bucket=${encodeURIComponent(bucket_name)}&err=${encodeURIComponent(d.detail || 'アップロード失敗')}`, req.url));
    }
    return NextResponse.redirect(new URL(`/s3?bucket=${encodeURIComponent(bucket_name)}&msg=${encodeURIComponent('アップロードしました')}`, req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/s3?bucket=${encodeURIComponent(bucket_name)}&err=${encodeURIComponent(e.message)}`, req.url));
  }
}
