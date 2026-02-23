import { type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: React.ReactNode;
  as?: 'button' | 'a';
  href?: string;
}

const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  fontSize: '0.9375rem',
  fontWeight: 600,
  fontFamily: 'var(--font-body)',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
  textDecoration: 'none',
  color: 'inherit',
} as const;

const variants: Record<Variant, React.CSSProperties> = {
  primary: {
    ...base,
    backgroundColor: 'var(--gold-primary)',
    color: 'var(--bg-deep)',
  },
  secondary: {
    ...base,
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-gold)',
  },
};

export function Button({
  variant = 'primary',
  children,
  as: Component = 'button',
  href,
  style,
  ...rest
}: ButtonProps) {
  const combinedStyle = { ...variants[variant], ...style };

  if (Component === 'a' && href) {
    return (
      <a href={href} style={combinedStyle} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" style={combinedStyle} {...rest}>
      {children}
    </button>
  );
}
