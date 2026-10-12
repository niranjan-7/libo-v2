import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  footer,
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <div className={`card ${className}`} style={style} {...props}>
      {(title || subtitle || headerAction) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: subtitle ? '0' : '14px' }}>
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
      {footer && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          {footer}
        </div>
      )}
    </div>
  );
};

export interface KpiCardProps {
  label: string;
  value: string | number;
  caption?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  caption,
  trend,
  icon,
  className = '',
}) => {
  return (
    <div className={`kpi-card ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <small>{label}</small>
        {icon && <span style={{ color: 'var(--muted)' }}>{icon}</span>}
      </div>
      <strong>{value}</strong>
      {(caption || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {caption && <span>{caption}</span>}
          {trend && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: trend.positive ? 'var(--success-text)' : 'var(--danger-text)',
              }}
            >
              {trend.positive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
