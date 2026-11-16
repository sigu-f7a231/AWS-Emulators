import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  highlight?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, highlight, className = '', style, ...props }) => {
  return (
    <article
      className={`card ${highlight ? 'card-highlight' : ''} ${className}`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: highlight ? '1px solid var(--aws-orange)' : '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        ...style,
      }}
      {...props}
    >
      {children}
    </article>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <header className={`card-header ${className}`} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    {children}
  </header>
);

export const CardTitle: React.FC<{ children: React.ReactNode; icon?: string }> = ({ children, icon }) => (
  <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
    {icon && <span>{icon}</span>}
    {children}
  </h2>
);

export const CardDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '12px' }}>
    {children}
  </p>
);

export const CardContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section>{children}</section>
);
