interface SectionProps {
  id?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}

export function Section({ id, title, children, className = '', narrow }: SectionProps) {
  return (
    <section
      id={id}
      className={className}
      style={{
        padding: 'var(--space-3xl) var(--space-lg)',
        maxWidth: narrow ? '720px' : '100%',
        margin: '0 auto',
      }}
    >
      {title && (
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 4vw, 2rem)',
            fontWeight: 600,
            color: 'var(--gold-primary)',
            marginBottom: 'var(--space-xl)',
            textAlign: 'center',
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
