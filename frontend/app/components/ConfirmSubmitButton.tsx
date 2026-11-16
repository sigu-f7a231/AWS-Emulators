'use client';
// 確認ダイアログ付きの送信ボタン。サーバーコンポーネントの <form> の中に置いて使う。
// （サーバーコンポーネントでは onSubmit / onClick を渡せないため、ここだけクライアントにする）
export default function ConfirmSubmitButton({
  message, children, className, style,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}
    >
      {children}
    </button>
  );
}
