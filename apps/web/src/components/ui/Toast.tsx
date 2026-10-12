import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration: number = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  const getIcon = (variant?: ToastVariant) => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 size={16} color="var(--success-text)" />;
      case 'error':
        return <AlertCircle size={16} color="var(--danger-text)" />;
      case 'warning':
        return <AlertCircle size={16} color="var(--warn-text)" />;
      default:
        return <Info size={16} color="var(--info-text)" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div
        role="region"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: '22px',
          right: '22px',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="toast"
            style={{
              position: 'relative',
              bottom: 'auto',
              right: 'auto',
              display: 'flex',
            }}
          >
            {getIcon(t.variant)}
            <span style={{ flex: 1, fontSize: '13px' }}>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
