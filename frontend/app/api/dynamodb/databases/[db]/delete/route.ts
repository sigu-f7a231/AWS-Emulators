import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// DB 削除（cascade=on ならテーブルごと）
export async function POST(req: NextRequest, { params }: { params: { db: string } }) {
  const form = await req.formData();
  const cascade = form.get('cascade') === 'on';
  try {
    const res = await fetch(
      `${B}/api/dynamodb/databases/${encodeURIComponent(params.db)}?cascade=${cascade}`,
      { method: 'DELETE' },
    );
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof d.detail === 'string' ? d.detail : 'DB の削除に失敗しました';
      return NextResponse.redirect(
        new URL(`/dynamodb/databases/${encodeURIComponent(params.db)}?err=${encodeURIComponent(detail)}`, req.url), 303);
    }
    return NextResponse.redirect(new URL(`/dynamodb?msg=${encodeURIComponent(d.message || 'DB を削除しました')}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/dynamodb?err=${encodeURIComponent(e.message)}`, req.url), 303);
  }
}
