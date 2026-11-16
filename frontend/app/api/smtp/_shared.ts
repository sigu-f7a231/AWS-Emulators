// SMTP 設定フォームの戻り先は Mailbox / Pipeline のどちらかだけを許可する
export function safeReturnTo(v: FormDataEntryValue | null): string {
  return v === '/pipeline' ? '/pipeline' : '/mailbox';
}

export function withParam(path: string, key: 'msg' | 'err', value: string): string {
  return `${path}?${key}=${encodeURIComponent(value)}#smtp`;
}
