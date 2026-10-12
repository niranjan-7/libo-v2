import React, { useId } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id: customId,
  className = '',
}) => {
  const generatedId = useId();
  const id = customId || generatedId;

  return (
    <div
      className={`appearance-mode-row ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {(label || description) && (
        <div>
          {label && (
            <label
              htmlFor={id}
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--text)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'block',
              }}
            >
              {label}
            </label>
          )}
          {description && (
            <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>
              {description}
            </small>
          )}
        </div>
      )}

      <label className="switch">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="switch-track" />
      </label>
    </div>
  );
};
