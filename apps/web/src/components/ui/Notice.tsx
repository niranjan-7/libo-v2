import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type NoticeVariant = 'warn' | 'info' | 'success' | 'danger';

export interface NoticeBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: NoticeVariant;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const NoticeBox: React.FC<NoticeBoxProps> = ({
  variant = 'warn',
  title,
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  const variantStyles: Record<NoticeVariant, { bg: string; text: string; border: string; defaultIcon: React.ReactNode }> = {
    warn: {
      bg: 'var(--warn)',
      text: 'var(--warn-text)',
      border: '#ead8a9',
      defaultIcon: <AlertTriangle size={16} />,
    },
    info: {
      bg: 'var(--info)',
      text: 'var(--info-text)',
      border: '#cde0fa',
      defaultIcon: <Info size={16} />,
    },
    success: {
      bg: 'var(--success)',
      text: 'var(--success-text)',
      border: '#b8dec4',
      defaultIcon: <CheckCircle2 size={16} />,
    },
    danger: {
      bg: 'var(--danger)',
      text: 'var(--danger-text)',
      border: '#f5c6c2',
      defaultIcon: <AlertCircle size={16} />,
    },
  };

  const v = variantStyles[variant];

  return (
    <div
      role="alert"
      className={`notice-box ${className}`}
      style={{
        background: v.bg,
        color: v.text,
        border: `1px solid ${v.border}`,
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        ...style,
      }}
      {...props}
    >
      <span style={{ flexShrink: 0, marginTop: '2px' }}>{icon || v.defaultIcon}</span>
      <div style={{ flex: 1 }}>
        {title && <strong style={{ display: 'block', marginBottom: '3px' }}>{title}</strong>}
        <div style={{ fontSize: '12px', lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
};
