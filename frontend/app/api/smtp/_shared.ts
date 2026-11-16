// SMTP 設定フォームの戻り先は Mailbox / Pipeline / SNS（トピック指定可）だけを許可する
export function safeReturnTo(v: FormDataEntryValue | null): string {
  const s = typeof v === 'string' ? v : '';
  if (s === '/pipeline' || s === '/mailbox' || s === '/sns') return s;
  if (/^\/sns\?topic=[^#\s]+$/.test(s) && !s.includes('//')) return s;
  return '/mailbox';
}

export function withParam(path: string, key: 'msg' | 'err', value: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}#smtp`;
}
