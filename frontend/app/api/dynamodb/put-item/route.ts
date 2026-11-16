import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const table_name = form.get('table_name') as string;

  // Gather attribute rows (attr_name[], attr_type[], attr_value[])
  const names = form.getAll('attr_name') as string[];
  const types = form.getAll('attr_type') as string[];
  const values = form.getAll('attr_value') as string[];

  const attributes = names
    .map((name, i) => ({ name: name.trim(), type: types[i] || 'S', value: values[i] || '' }))
    // 値が空欄の行は保存しない（NULL 型は値なしで NULL を保存）。
    // DB/テーブル設計のテーブルではカラムが全部並ぶため、未入力のカラムを "" や 0 で保存しないようにする
    .filter(a => a.name !== '' && (a.type === 'NULL' || a.value !== ''));

  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/item`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_name, attributes }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const p = new URLSearchParams({ err: data.detail || 'アイテム保存に失敗しました' });
      return NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${p}`, req.url));
    }

    const p = new URLSearchParams({ msg: 'アイテムを保存しました' });
    return NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${p}`, req.url));
  } catch (e: any) {
    const p = new URLSearchParams({ err: e.message || '接続エラー' });
    return NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${p}`, req.url));
  }
}
