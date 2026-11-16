import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// テーブル作成（CreateTableForm から JSON で呼ばれる → バックエンドへ中継し、結果を JSON で返す）
export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    const res = await fetch(`${B}/api/dynamodb/tables`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message || 'バックエンドに接続できません' }, { status: 502 });
  }
}
