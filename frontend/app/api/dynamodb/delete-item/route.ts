import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// アイテム削除（DeleteItem）。key_json はキー属性だけの DynamoDB JSON（例: {"id":{"S":"1"}}）
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const table_name = form.get('table_name') as string;
  const back = (q: Record<string, string>) =>
    NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${new URLSearchParams(q)}`, req.url), 303);

  let key_attributes: unknown;
  try { key_attributes = JSON.parse((form.get('key_json') as string) || ''); } catch {
    return back({ err: '削除するアイテムのキーが不正です' });
  }
  try {
    const res = await fetch(`${B}/api/dynamodb/item`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_name, key_attributes }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return back({ err: typeof d.detail === 'string' ? d.detail : '削除に失敗しました' });
    }
    return back({ msg: 'アイテムを削除しました' });
  } catch (e: any) {
    return back({ err: e.message || '接続エラー' });
  }
}
