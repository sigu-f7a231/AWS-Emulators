import { NextRequest, NextResponse } from 'next/server';
const B = process.env.BACKEND_INTERNAL_URL || 'http://python:8000';

// アイテム保存（PutItem）。
// item_json（DynamoDB JSON）が入っていればそれを、無ければ行形式（attr_name[] / attr_type[] / attr_value[]）を送る。
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const table_name = form.get('table_name') as string;
  const back = (q: Record<string, string>) =>
    NextResponse.redirect(new URL(`/dynamodb/${encodeURIComponent(table_name)}?${new URLSearchParams(q)}`, req.url), 303);

  const itemJson = ((form.get('item_json') as string) || '').trim();
  let body: Record<string, unknown>;
  if (itemJson) {
    let item: unknown;
    try { item = JSON.parse(itemJson); } catch (e: any) {
      return back({ err: `DynamoDB JSON として読めません: ${e.message}` });
    }
    body = { table_name, item };
  } else {
    const names = form.getAll('attr_name') as string[];
    const types = form.getAll('attr_type') as string[];
    const values = form.getAll('attr_value') as string[];
    const attributes = names
      .map((name, i) => ({ name: name.trim(), type: types[i] || 'S', value: values[i] ?? '' }))
      // 名前が空の行は無視。値が空の行も保存しない（NULL 型と、空文字を明示した S 型は除く）
      .filter(a => a.name !== '' && (a.type === 'NULL' || a.value !== ''));
    body = { table_name, attributes };
  }

  try {
    const res = await fetch(`${B}/api/dynamodb/item`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const detail = typeof d.detail === 'string' ? d.detail
        : Array.isArray(d.detail) ? d.detail.map((x: any) => x.msg).join(' / ') : 'アイテム保存に失敗しました';
      return back({ err: detail });
    }
    return back({ msg: 'アイテムを保存しました' });
  } catch (e: any) {
    return back({ err: e.message || '接続エラー' });
  }
}
