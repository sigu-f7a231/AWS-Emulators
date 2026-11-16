import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'gray';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'gray', size = 'sm' }) => {
  const getColors = () => {
    switch (variant) {
      case 'orange':
        return { bg: 'rgba(255, 153, 0, 0.15)', text: '#fbbf24', border: 'rgba(255, 153, 0, 0.3)' };
      case 'green':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'blue':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
      case 'purple':
        return { bg: 'rgba(139, 92, 246, 0.15)', text: '#c084fc', border: 'rgba(139, 92, 246, 0.3)' };
      case 'red':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'gray':
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  const colors = getColors();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        fontSize: size === 'sm' ? '11px' : '13px',
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};
