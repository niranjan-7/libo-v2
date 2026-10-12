import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  eyebrow,
  description,
  icon,
  width = '390px',
  footer,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 49,
            transition: 'opacity 0.2s',
          }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`settings-drawer ${isOpen ? 'open' : ''}`}
        aria-hidden={!isOpen}
        style={{
          width,
        }}
      >
        {/* Header */}
        <div className="style-drawer-head">
          {icon && <div className="style-orb">{icon}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && (
              <h2 style={{ margin: '2px 0 3px', fontSize: '20px', letterSpacing: '-0.04em' }}>
                {title}
              </h2>
            )}
            {description && (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '11px' }}>
                {description}
              </p>
            )}
          </div>
          <IconButton
            aria-label="Close drawer"
            variant="ghost"
            onClick={onClose}
          >
            <X size={18} />
          </IconButton>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 0', flex: 1 }}>{children}</div>

        {/* Footer */}
        {footer && <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>{footer}</div>}
      </aside>
    </>
  );
};
