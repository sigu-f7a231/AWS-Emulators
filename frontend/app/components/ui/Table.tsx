import React from 'react';

export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div style={{ width: '100%', overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }} className={className}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
    {children}
  </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody>{children}</tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, style, ...props }) => (
  <tr
    style={{
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      transition: 'background-color 0.15s',
      ...style,
    }}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', ...style }}>
    {children}
  </th>
);

export const TableCell: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <td style={{ padding: '12px 14px', verticalAlign: 'middle', ...style }}>
    {children}
  </td>
);
