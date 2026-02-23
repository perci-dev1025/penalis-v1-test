interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 40, showText = true, className = '' }: LogoProps) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M24 4L8 10v10c0 11 8 20 16 24 8-4 16-13 16-24V10L24 4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
          style={{ color: 'var(--gold-primary)' }}
        />
        <path
          d="M24 18v12M18 22l6-4 6 4M20 30l4-8 4 8"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{ color: 'var(--gold-primary)' }}
        />
        <circle cx="24" cy="18" r="1.5" fill="currentColor" style={{ color: 'var(--gold-primary)' }} />
      </svg>
      {showText && (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: size >= 36 ? '1.75rem' : '1.25rem',
            color: 'var(--gold-primary)',
            letterSpacing: '0.02em',
          }}
        >
          PENALIS
        </span>
      )}
    </div>
  );
}
