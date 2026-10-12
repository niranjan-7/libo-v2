import React, { useId } from 'react';
import { Search, X } from 'lucide-react';

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  hint,
  error,
  required,
  htmlFor,
  className = '',
  children,
}) => {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={htmlFor} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            {label} {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
          </span>
        </label>
      )}
      {children}
      {hint && !error && <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{hint}</small>}
      {error && (
        <small style={{ color: 'var(--danger-text)', fontSize: '11px', fontWeight: 600 }}>
          {error}
        </small>
      )}
    </div>
  );
};

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  prefixIcon?: React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
  error,
  prefixIcon,
  className = '',
  style,
  ...props
}) => {
  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
      {prefixIcon && (
        <span
          style={{
            position: 'absolute',
            left: '12px',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {prefixIcon}
        </span>
      )}
      <input
        className={`input ${className}`}
        aria-invalid={!!error}
        style={{
          paddingLeft: prefixIcon ? '36px' : undefined,
          borderColor: error ? 'var(--danger-text)' : undefined,
          ...style,
        }}
        {...props}
      />
    </div>
  );
};

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search title, author, ISBN or topic...',
  className = '',
  style,
  ...props
}) => {
  return (
    <div className={`searchbar ${className}`} style={style}>
      <Search size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<{ value: string; label: string }>;
  error?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  error,
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <select
      className={`field-select ${className}`}
      aria-invalid={!!error}
      style={{
        width: '100%',
        border: '1px solid var(--border)',
        borderRadius: '11px',
        padding: '12px 13px',
        background: 'var(--surface)',
        color: 'var(--text)',
        borderColor: error ? 'var(--danger-text)' : undefined,
        ...style,
      }}
      {...props}
    >
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  error,
  className = '',
  style,
  ...props
}) => {
  return (
    <textarea
      className={className}
      aria-invalid={!!error}
      style={{
        width: '100%',
        border: '1px solid var(--border)',
        borderRadius: '11px',
        padding: '12px 13px',
        background: 'var(--surface)',
        color: 'var(--text)',
        minHeight: '88px',
        resize: 'vertical',
        borderColor: error ? 'var(--danger-text)' : undefined,
        ...style,
      }}
      {...props}
    />
  );
};
