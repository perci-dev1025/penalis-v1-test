import { useState } from 'react';
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

const DEMO_EXAMPLE_QUERIES: Record<string, string> = {
  consulta: '¿Cuáles son los requisitos y efectos del sobreseimiento en la fase preparatoria según el COPP?',
  audiencia: 'Solicitud de medida cautelar sustitutiva; el imputado tiene arraigo laboral y no tiene antecedentes.',
  debate: 'La fiscalía sostiene que los elementos de convicción son suficientes para abrir a juicio; defensa debe refutar.',
  formatos: 'Solicitud de libertad bajo fianza; el imputado no tiene antecedentes y tiene trabajo estable.',
};

const DEMO_SAMPLE_RESULTS: Record<string, { title: string; sections: { label: string; text: string }[] }> = {
  consulta: {
    title: 'Análisis de consulta jurídica',
    sections: [
      { label: 'Marco constitucional aplicable', text: 'La Constitución de la República Bolivariana de Venezuela consagra el derecho a la defensa y el principio de legalidad. El sobreseimiento se inscribe en el derecho al debido proceso.' },
      { label: 'Marco legal relevante', text: 'COPP, arts. 321 y ss. El juez de control puede decretar el sobreseimiento cuando no existan elementos suficientes para la acusación.' },
      { label: 'Conclusión jurídica', text: 'Procederá el sobreseimiento en fase preparatoria cuando la investigación no arroje elementos de convicción suficientes, previa solicitud del Ministerio Público o de la defensa.' },
    ],
  },
  audiencia: {
    title: 'Respuesta táctica (Audiencia)',
    sections: [
      { label: 'Marco legal aplicable', text: 'COPP, art. 251: medidas cautelares sustitutivas. Criterios de procedencia: arraigo, ausencia de antecedentes, garantías de no fuga.' },
      { label: 'Recomendación táctica inmediata', text: 'Solicitar la sustitución de la privación de libertad por presentación periódica y prohibición de salida del país, destacando el arraigo laboral y la conducta anterior.' },
    ],
  },
  debate: {
    title: 'Refutación técnica (Debate)',
    sections: [
      { label: 'Identificación de la tesis contraria', text: 'La fiscalía sostiene que los elementos de convicción reunidos son suficientes para la apertura a juicio.' },
      { label: 'Marco legal aplicable', text: 'COPP: estándar de apertura a juicio; carga de la acusación; elementos de convicción.' },
      { label: 'Riesgos procesales', text: 'Refutar la suficiencia probatoria señalando las lagunas y contradicciones del expediente, sin conceder valor a pruebas débiles o inconexas.' },
    ],
  },
  formatos: {
    title: 'Documento generado (Formatos Penales)',
    sections: [
      { label: 'Encabezado', text: 'Escrito dirigido al Tribunal de Control, con fundamento en los artículos 251 y 252 del COPP.' },
      { label: 'Hechos', text: 'El imputado no tiene antecedentes penales y acredita trabajo estable. Solicitud de libertad bajo fianza.' },
      { label: 'Fundamento jurídico', text: 'El COPP permite la medida sustitutiva cuando concurran criterios de arraigo y no exista riesgo de fuga. Los hechos expuestos justifican la concesión de la libertad bajo fianza.' },
      { label: 'Petitorio', text: 'Se solicita se declare procedente la libertad bajo fianza en los términos legales.' },
    ],
  },
};

const DIFERENCIAL = [
  'Respuestas fundamentadas en normativa vigente y jurisprudencia.',
  'Estructura por artículo y por fuente (Constitución, COPP, Código Penal).',
  'Citación verificable en cada resultado.',
  'Rigor en la fundamentación sin invención de fuentes.',
  'Distinción entre normas y jurisprudencia aplicable.',
];

const PUBLICO = ['Abogados penalistas', 'Fiscales', 'Defensores', 'Jueces', 'Estudiantes avanzados de derecho'];

const PLANES = [
  { name: 'Plan Profesional', desc: 'Para el ejercicio individual.' },
  { name: 'Plan Pro', desc: 'Para equipos y mayor volumen.' },
  { name: 'Plan Institucional', desc: 'Para firmas y organismos.' },
];

export function Landing() {
  const [demoMode, setDemoMode] = useState<string>('consulta');
  const [showDemoResult, setShowDemoResult] = useState(false);

  const demoExample = DEMO_EXAMPLE_QUERIES[demoMode] || DEMO_EXAMPLE_QUERIES.consulta;
  const demoResult = DEMO_SAMPLE_RESULTS[demoMode] || DEMO_SAMPLE_RESULTS.consulta;

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
          <p>Cada respuesta se apoya en el corpus legal venezolano actualizado, con referencias a normas y jurisprudencia.</p>
        </div>
      </Section>

      <Section id="como-funciona" title="Ver cómo funciona">
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', maxWidth: '560px', margin: '0 auto var(--space-lg)' }}>
          Seleccione un modo, revise el ejemplo de consulta y vea un resultado estratégico de muestra.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => { setDemoMode(mode.id); setShowDemoResult(false); }}
              style={{
                padding: 'var(--space-sm) var(--space-md)',
                borderRadius: 'var(--radius-md)',
                border: demoMode === mode.id ? '2px solid var(--gold-primary)' : '1px solid var(--border)',
                background: demoMode === mode.id ? 'rgba(212, 163, 115, 0.12)' : 'var(--bg-card)',
                color: demoMode === mode.id ? 'var(--gold-primary)' : 'var(--text-secondary)',
                fontFamily: 'inherit',
                fontSize: '0.9375rem',
                cursor: 'pointer',
                fontWeight: demoMode === mode.id ? 600 : 400,
              }}
            >
              {mode.title}
            </button>
          ))}
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto var(--space-md)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ejemplo de consulta</div>
          <div style={{ padding: 'var(--space-md) var(--space-lg)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {demoExample}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <Button variant="primary" type="button" onClick={() => setShowDemoResult((v) => !v)}>
            {showDemoResult ? 'Ocultar ejemplo' : 'Ver ejemplo de resultado'}
          </Button>
        </div>
        {showDemoResult && (
          <div
            className="penalis-result-document"
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              padding: 'var(--space-xl)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-gold, rgba(212, 163, 115, 0.4))',
              borderRadius: 'var(--radius-lg)',
              borderLeft: '4px solid var(--gold-primary)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-gold, rgba(212, 163, 115, 0.3))', paddingBottom: 'var(--space-sm)' }}>
              {demoResult.title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              {demoResult.sections.map((sec, i) => (
                <section key={i}>
                  <h4 className="penalis-doc-section-title">{sec.label}</h4>
                  <p className="penalis-doc-body" style={{ margin: 0 }}>{sec.text}</p>
                </section>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-lg)', maxWidth: '1100px', margin: 'var(--space-2xl) auto 0' }}>
          {MODES.map((mode) => (
            <div key={mode.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-sm)' }}>{mode.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>{mode.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="diferencial" title="Ventajas">
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
