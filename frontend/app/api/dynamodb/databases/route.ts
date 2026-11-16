import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// DB 作成（フォーム送信 → /dynamodb にリダイレクト）
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = ((form.get('name') as string) || '').trim();
  const description = ((form.get('description') as string) || '').trim();
  try {
    const res = await fetch(`${B}/api/dynamodb/databases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof d.detail === 'string' ? d.detail : 'DB の作成に失敗しました';
      return NextResponse.redirect(new URL(`/dynamodb?err=${encodeURIComponent(detail)}`, req.url), 303);
    }
    return NextResponse.redirect(
      new URL(`/dynamodb/databases/${encodeURIComponent(name)}?msg=${encodeURIComponent(d.message || 'DB を作成しました')}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/dynamodb?err=${encodeURIComponent(e.message)}`, req.url), 303);
  }
}
