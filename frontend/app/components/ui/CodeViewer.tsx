'use client';

import React, { useState } from 'react';

interface CodeViewerProps {
  code: string | object;
  language?: string;
  maxHeight?: string;
  title?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ code, language = 'json', maxHeight = '300px', title }) => {
  const [copied, setCopied] = useState(false);

  const formattedCode = typeof code === 'object' ? JSON.stringify(code, null, 2) : String(code);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ backgroundColor: 'var(--code-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{title} ({language})</span>
          <button
            onClick={handleCopy}
            style={{ background: 'none', border: 'none', color: copied ? '#34d399' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
          >
            {copied ? '✔ コピー完了' : '📋 コピー'}
          </button>
        </div>
      )}
      <div style={{ padding: '12px', maxHeight, overflowY: 'auto' }}>
        <pre style={{ margin: 0, fontSize: '12px', color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {formattedCode}
        </pre>
      </div>
    </div>
  );
};
