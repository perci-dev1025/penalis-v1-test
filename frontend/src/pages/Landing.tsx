import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Section } from '../components/Section';

const MODES = [
  { id: 'audiencia', title: 'Modo Audiencia', description: 'Respuesta breve, táctica y estructurada. Acción sugerida + Artículo + Frase procesal.' },
  { id: 'debate', title: 'Modo Debate Oral', description: 'Argumentación estructurada: Tesis → Fundamento → Solicitud.' },
  { id: 'consulta', title: 'Modo Consulta Jurídica', description: 'Análisis doctrinal con citación verificable.' },
  { id: 'formatos', title: 'Modo Formatos Penales', description: 'Generación estructurada de escritos: Encabezado → Hechos → Derecho → Petitorio.' },
];

const DIFERENCIAL = [
  'Arquitectura RAG estructurada por artículo.',
  'Chunking jurídico jerárquico: Libro > Título > Capítulo > Artículo.',
  'Citación literal verificable.',
  'Control de alucinación.',
  'Separación normativa / jurisprudencial.',
];

const PUBLICO = ['Abogados penalistas', 'Fiscales', 'Defensores', 'Jueces', 'Estudiantes avanzados de derecho'];

const PLANES = [
  { name: 'Plan Profesional', desc: 'Para el ejercicio individual.' },
  { name: 'Plan Pro', desc: 'Para equipos y mayor volumen.' },
  { name: 'Plan Institucional', desc: 'Para firmas y organismos.' },
];

export function Landing() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl) var(--space-lg)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse, var(--gold-subtle) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '40%', height: '40%', background: 'radial-gradient(ellipse, var(--gold-subtle) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Logo size={48} showText className="hero-logo" />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 700, color: 'var(--gold-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)', textAlign: 'center', letterSpacing: '0.02em' }}>
          Motor de Precisión Jurídica Penal
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '480px', marginBottom: 'var(--space-2xl)' }}>
          Inteligencia jurídica especializada para el ejercicio penal venezolano.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', justifyContent: 'center' }}>
          <Link to="/login"><Button variant="primary">Probar ahora</Button></Link>
          <Link to="/#como-funciona"><Button variant="secondary">Ver cómo funciona</Button></Link>
        </div>
      </header>

      <Section id="que-es" title="¿Qué es PENALIS?">
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '1.0625rem' }}>
          <p style={{ marginBottom: 'var(--space-md)' }}>PENALIS no es un chatbot jurídico. Es un sistema estructurado de asistencia penal basado en normativa vigente y jurisprudencia verificable.</p>
          <p>Opera mediante arquitectura RAG, garantizando que cada respuesta esté fundamentada en el corpus legal venezolano actualizado.</p>
        </div>
      </Section>

      <Section id="como-funciona" title="Modos de uso">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-lg)', maxWidth: '1100px', margin: '0 auto' }}>
          {MODES.map((mode) => (
            <div key={mode.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-sm)' }}>{mode.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>{mode.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="diferencial" title="Diferencial técnico">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          {DIFERENCIAL.map((item, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-sm) 0', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold-primary)', flexShrink: 0 }} />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="publico" title="Público objetivo">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--space-md)' }}>
          {PUBLICO.map((item) => (
            <span key={item} style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{item}</span>
          ))}
        </div>
      </Section>

      <Section id="planes" title="Planes">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)', maxWidth: '900px', margin: '0 auto' }}>
          {PLANES.map((plan) => (
            <div key={plan.name} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', marginBottom: 'var(--space-sm)' }}>{plan.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>{plan.desc}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 'var(--space-sm)' }}>(Precios por definir)</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="cierre" narrow>
        <p style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-sm)' }}>PENALIS no sustituye al abogado.</p>
        <p style={{ textAlign: 'center', fontSize: '1.125rem', color: 'var(--text-secondary)', margin: 0 }}>Potencia su precisión.</p>
      </Section>

      <footer style={{ padding: 'var(--space-xl) var(--space-lg)', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <Logo size={28} showText />
        <p style={{ marginTop: 'var(--space-md)', marginBottom: 0 }}>Motor de Precisión Jurídica Penal — Venezuela</p>
      </footer>
    </div>
  );
}
