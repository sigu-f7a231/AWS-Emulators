import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const bucket_name = (form.get('bucket_name') as string || '').trim();

  try {
    const res = await fetch(`${B}/api/s3/buckets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket_name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.redirect(new URL(`/s3?err=${encodeURIComponent(d.detail || '作成失敗')}`, req.url));
    }
    return NextResponse.redirect(new URL(`/s3?msg=${encodeURIComponent(`バケット "${bucket_name}" を作成しました`)}&bucket=${encodeURIComponent(bucket_name)}`, req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/s3?err=${encodeURIComponent(e.message)}`, req.url));
  }
}
