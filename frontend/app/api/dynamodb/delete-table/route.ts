import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// テーブル削除（フォーム送信 → /dynamodb にリダイレクト）
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const table_name = ((form.get('table_name') as string) || '').trim();
  try {
    const res = await fetch(`${B}/api/dynamodb/tables/${encodeURIComponent(table_name)}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    const p = res.ok
      ? new URLSearchParams({ msg: `テーブル "${table_name}" を削除しました` })
      : new URLSearchParams({ err: typeof d.detail === 'string' ? d.detail : 'テーブルの削除に失敗しました' });
    return NextResponse.redirect(new URL(`/dynamodb?${p}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/dynamodb?${new URLSearchParams({ err: e.message || '接続エラー' })}`, req.url), 303);
  }
}
