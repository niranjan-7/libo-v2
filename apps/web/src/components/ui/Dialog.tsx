import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  footer,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: '400px',
    md: '500px',
    lg: '650px',
    xl: '800px',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.48)',
        backdropFilter: 'blur(5px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: '16px',
        animation: 'fadeIn 0.18s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
          width: '100%',
          maxWidth: maxWidths[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 24px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {title}
                </h2>
              )}
              {description && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  {description}
                </p>
              )}
            </div>
          </div>

          <IconButton
            aria-label="Close dialog"
            variant="ghost"
            onClick={onClose}
          >
            <X size={18} />
          </IconButton>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              background: 'color-mix(in srgb, var(--canvas) 50%, var(--surface))',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
