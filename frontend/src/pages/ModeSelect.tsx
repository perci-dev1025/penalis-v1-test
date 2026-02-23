import { useNavigate } from 'react-router-dom';

const MODES = [
  { id: 'audiencia', title: 'Modo Audiencia', short: 'Audiencia', description: 'Respuesta breve, táctica y estructurada. Acción sugerida + Artículo + Frase procesal.' },
  { id: 'debate', title: 'Modo Debate Oral', short: 'Debate Oral', description: 'Argumentación estructurada: Tesis → Fundamento → Solicitud.' },
  { id: 'consulta', title: 'Modo Consulta Jurídica', short: 'Consulta Jurídica', description: 'Análisis doctrinal con citación verificable.' },
  { id: 'formatos', title: 'Modo Formatos Penales', short: 'Formatos Penales', description: 'Generación estructurada de escritos: Encabezado → Hechos → Derecho → Petitorio.' },
];

export function ModeSelect() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', padding: 'var(--space-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: 'var(--text-primary)', marginBottom: 'var(--space-sm)', textAlign: 'center' }}>Seleccione el modo</h1>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 'var(--space-2xl)', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>Elija el modo según el tipo de asistencia que necesite.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)', maxWidth: '1000px', margin: '0 auto' }}>
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => navigate(`/app/consulta?mode=${mode.id}`)}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s ease, background 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold-primary)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-sm)' }}>{mode.short}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>{mode.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
