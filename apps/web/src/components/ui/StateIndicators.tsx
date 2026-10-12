import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  description = 'There are currently no records to display in this view.',
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`empty-state ${className}`}>
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: 'var(--canvas)',
          color: 'var(--muted)',
          display: 'inline-grid',
          placeItems: 'center',
          marginBottom: '14px',
        }}
      >
        {icon || <Inbox size={22} />}
      </div>
      <strong>{title}</strong>
      <p style={{ margin: '0 auto 16px', maxWidth: '420px', fontSize: '12px', lineHeight: 1.55 }}>
        {description}
      </p>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

export interface LoadingStateProps {
  message?: string;
  submessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  submessage,
}) => {
  return (
    <div
      role="status"
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Loader2
        size={32}
        color="var(--accent)"
        style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }}
      />
      <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{message}</strong>
      {submessage && (
        <small style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
          {submessage}
        </small>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section.',
  onRetry,
}) => {
  return (
    <div
      role="alert"
      style={{
        border: '1px solid var(--danger)',
        background: 'color-mix(in srgb, var(--danger) 30%, var(--surface))',
        borderRadius: 'var(--radius)',
        padding: '32px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: 'var(--danger)',
          color: 'var(--danger-text)',
          display: 'inline-grid',
          placeItems: 'center',
          marginBottom: '12px',
        }}
      >
        <AlertCircle size={22} />
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>{title}</h3>
      <p style={{ margin: '0 auto 16px', maxWidth: '420px', fontSize: '12px', color: 'var(--muted)' }}>
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<RefreshCw size={13} />}>
          Try again
        </Button>
      )}
    </div>
  );
};

export interface ProgressBarProps {
  value: number; // 0 - 100
  label?: string;
  ariaLabel?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  ariaLabel = 'Progress',
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <span className="progress-bar" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
};
