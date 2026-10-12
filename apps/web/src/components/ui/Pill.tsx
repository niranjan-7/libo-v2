import React from 'react';

export type PillVariant = 'green' | 'yellow' | 'red' | 'blue' | 'neutral';

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  hasDot?: boolean;
  children: React.ReactNode;
}

export const Pill: React.FC<PillProps> = ({
  variant = 'neutral',
  hasDot = false,
  children,
  className = '',
  style,
  ...props
}) => {
  const variantClass = variant === 'neutral' ? '' : variant;
  const classes = ['pill', variantClass, className].filter(Boolean).join(' ');

  return (
    <span className={classes} style={style} {...props}>
      {hasDot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  );
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
  style?: React.CSSProperties;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, style }) => {
  let variant: PillVariant = 'blue';

  if (/Available|Ready|Completed|Active|Delivered|Published|Paid|Success|Fulfilled|Enabled/i.test(status)) {
    variant = 'green';
  } else if (/Overdue|Lost|Damaged|Failed|Blocked|Rejected|Expired|Late/i.test(status)) {
    variant = 'red';
  } else if (/Pending|Waitlist|Invited|Review|Queued|Processing|Allocated|Unpaid/i.test(status)) {
    variant = 'yellow';
  }

  return (
    <Pill variant={variant} className={className} style={style}>
      {status}
    </Pill>
  );
};

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number | string;
  children: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  active = false,
  count,
  children,
  className = '',
  ...props
}) => {
  const classes = ['chip', active ? 'active' : '', className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} {...props}>
      {children}
      {count !== undefined && (
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '999px',
            background: active ? 'var(--accent)' : 'var(--border)',
            color: active ? '#fff' : 'var(--muted)',
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
};
