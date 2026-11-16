import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// テーブル削除（フォーム送信 → DB 詳細にリダイレクト）
export async function POST(req: NextRequest, { params }: { params: { db: string; table: string } }) {
  const dest = `/dynamodb/databases/${encodeURIComponent(params.db)}`;
  try {
    const res = await fetch(
      `${B}/api/dynamodb/databases/${encodeURIComponent(params.db)}/tables/${encodeURIComponent(params.table)}`,
      { method: 'DELETE' },
    );
    const d = await res.json().catch(() => ({}));
    const key = res.ok ? 'msg' : 'err';
    const text = res.ok ? (d.message || '削除しました') : (typeof d.detail === 'string' ? d.detail : '削除に失敗しました');
    return NextResponse.redirect(new URL(`${dest}?${key}=${encodeURIComponent(text)}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`${dest}?err=${encodeURIComponent(e.message)}`, req.url), 303);
  }
}
