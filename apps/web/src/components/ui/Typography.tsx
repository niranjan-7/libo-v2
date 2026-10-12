import React from 'react';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}

export const Heading: React.FC<HeadingProps> = ({
  level = 2,
  className = '',
  children,
  style,
  ...props
}) => {
  const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4';
  const defaultStyles: Record<number, React.CSSProperties> = {
    1: { fontSize: 'clamp(25px, 2.3vw, 34px)', letterSpacing: '-0.045em', fontWeight: 780, lineHeight: 1.15, margin: '0 0 6px' },
    2: { fontSize: '20px', letterSpacing: '-0.03em', fontWeight: 780, lineHeight: 1.25, margin: '0 0 6px' },
    3: { fontSize: '15px', letterSpacing: '-0.02em', fontWeight: 750, lineHeight: 1.3, margin: '0 0 4px' },
    4: { fontSize: '13px', letterSpacing: '-0.01em', fontWeight: 700, lineHeight: 1.35, margin: '0 0 2px' },
  };

  return (
    <Tag style={{ ...defaultStyles[level], ...style }} className={className} {...props}>
      {children}
    </Tag>
  );
};

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  size?: 'base' | 'small' | 'tiny';
  muted?: boolean;
  bold?: boolean;
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  size = 'base',
  muted = false,
  bold = false,
  style,
  children,
  ...props
}) => {
  const fontSizes = {
    base: 'var(--font-size, 14px)',
    small: '12px',
    tiny: '11px',
  };

  return (
    <p
      style={{
        margin: '0 0 8px',
        fontSize: fontSizes[size],
        color: muted ? 'var(--muted)' : 'inherit',
        fontWeight: bold ? 700 : 'normal',
        lineHeight: 1.55,
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
};

export const Eyebrow: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  children,
  style,
  ...props
}) => (
  <span
    className="eyebrow"
    style={{
      fontSize: '9px',
      fontWeight: 850,
      letterSpacing: '0.13em',
      color: 'var(--accent)',
      textTransform: 'uppercase',
      display: 'inline-block',
      ...style,
    }}
    {...props}
  >
    {children}
  </span>
);

export const Kicker: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  children,
  style,
  ...props
}) => (
  <span
    className="cover-kicker"
    style={{
      fontSize: '8px',
      letterSpacing: '0.14em',
      fontWeight: 800,
      textTransform: 'uppercase',
      opacity: 0.9,
      ...style,
    }}
    {...props}
  >
    {children}
  </span>
);
