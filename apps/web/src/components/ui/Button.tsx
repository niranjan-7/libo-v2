import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  isLoading = false,
  fullWidth = false,
  children,
  className = '',
  style,
  disabled,
  ...props
}) => {
  const variantClass = variant === 'secondary' ? '' : variant;
  const sizeClass = size === 'md' ? '' : size;
  const classes = ['btn', variantClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      style={{
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 12 : 15} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        iconLeft
      )}
      {children}
      {!isLoading && iconRight}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'surface' | 'ghost';
  hasBadge?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  'aria-label': ariaLabel,
  size = 'md',
  variant = 'surface',
  hasBadge = false,
  children,
  className = '',
  style,
  ...props
}) => {
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { width: '32px', height: '32px', borderRadius: '10px' },
    md: { width: '38px', height: '38px', borderRadius: '12px' },
    lg: { width: '44px', height: '44px', borderRadius: '14px' },
  };

  return (
    <button
      className={`icon-btn ${className}`}
      aria-label={ariaLabel}
      style={{
        ...sizeStyles[size],
        background: variant === 'ghost' ? 'transparent' : undefined,
        border: variant === 'ghost' ? 'none' : undefined,
        position: 'relative',
        ...style,
      }}
      {...props}
    >
      {children}
      {hasBadge && (
        <span
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--accent)',
          }}
        />
      )}
    </button>
  );
};
