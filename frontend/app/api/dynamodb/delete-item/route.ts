import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const table_name = form.get('table_name') as string;
  const pk_name = form.get('pk_name') as string;
  const pk_type = form.get('pk_type') as string;
  const pk_value = form.get('pk_value') as string;
  const sk_name = form.get('sk_name') as string | null;
  const sk_type = form.get('sk_type') as string | null;
  const sk_value = form.get('sk_value') as string | null;

  const keyAttributes: Record<string, Record<string, unknown>> = {
    [pk_name]: { [pk_type]: pk_type === 'N' ? pk_value : pk_value },
  };
  if (sk_name && sk_value) {
    keyAttributes[sk_name] = { [sk_type || 'S']: sk_value };
  }

  try {
    const res = await fetch(`${BACKEND}/api/dynamodb/item`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_name, key_attributes: keyAttributes }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const p = new URLSearchParams({ err: data.detail || '削除に失敗しました' });
      return NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${p}`, req.url));
    }

    const p = new URLSearchParams({ msg: 'アイテムを削除しました' });
    return NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${p}`, req.url));
  } catch (e: any) {
    const p = new URLSearchParams({ err: e.message || '接続エラー' });
    return NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${p}`, req.url));
  }
}
