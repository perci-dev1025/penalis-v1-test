import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { apiFetch } from '../services/api';

type RagResult = {
  id: string;
  documentId: string;
  article: string | null;
  section: string | null;
  text: string;
  similarity: number;
  rank: number;
  sourceType: string;
  hierarchyRank: number;
  passedThreshold: boolean;
  document: {
    id: string;
    name: string;
    path: string;
    sourceType: string;
    hierarchyRank: number;
    system: string | null;
    organ: string | null;
  };
};

type RagBrief = {
  action: string;
  article: string;
  proceduralPhrase: string;
  maestro?: {
    applicableLegalFramework: string;
    proceduralTechnicalAnalysis: string;
    oralInterventionStrategy: string;
    strategicWeakness: string;
    proceduralRisks: string;
    immediateTacticalRecommendation: string;
  };
  debateMaster?: {
    identificationOfOpposingThesis: string;
    applicableLegalFramework: string;
    evidentiaryAnalysis: string;
    structuralLegalRefutation: string;
    detectedVulnerability: string;
    counterattackStrategy: string;
    possibleCounterargumentOfOpposingParty: string;
    recommendedPreventiveResponse: string;
    proceduralRisks: string;
  };
  consulta?: {
    constitutionalFramework: string;
    legalFramework: string;
    doctrinalAnalysis: string;
    applicationToCase: string;
    conclusion: string;
    strategicWeakness: string;
  };
  formatosDocument?: {
    heading: string;
    identification: string;
    facts: string;
    legalBasis: string;
    petition: string;
    dateSignature: string;
  };
};

type RagResponse = {
  id: string | null;
  abstained: boolean;
  threshold: number;
  results: RagResult[];
  message?: string;
  brief?: RagBrief;
};

const MODE_LABELS: Record<string, { label: string; placeholder: string; button: string }> = {
  audiencia: {
    label: 'Situación o tema para audiencia',
    placeholder: 'Describa brevemente la situación o el punto a fundamentar...',
    button: 'Obtener respuesta táctica',
  },
  debate: {
    label: 'Tesis o tema para debate oral',
    placeholder: 'Describa la tesis contraria o el argumento a refutar (fiscal o defensa)...',
    button: 'Obtener argumentación',
  },
  consulta: {
    label: 'Consulta',
    placeholder: 'Redacte su consulta jurídica...',
    button: 'Consultar corpus PENALIS',
  },
  formatos: {
    label: 'Escrito o tema para formato penal',
    placeholder: 'Describa los hechos y el tipo de escrito (solicitud, recurso, etc.)...',
    button: 'Generar estructura del escrito',
  },
};

export function Consultation() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'consulta';
  const modeConfig = MODE_LABELS[mode] || MODE_LABELS.consulta;

  const [query, setQuery] = useState('');
  const [audienciaRole, setAudienciaRole] = useState<'defensa' | 'fiscal'>('defensa');
  const [debateRole, setDebateRole] = useState<'defensa' | 'fiscal'>('defensa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rag, setRag] = useState<RagResponse | null>(null);
  const [showCitations, setShowCitations] = useState(false);
  const formatosPrintRef = useRef<HTMLDivElement>(null);

  async function exportFormatosWord(doc: RagBrief['formatosDocument']) {
    if (!doc) return;
    const token = sessionStorage.getItem('penalis_auth_token');
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL ?? ''}/api/rag/export/formatos/docx`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ formatosDocument: doc }),
      },
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'documento-penal.docx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportFormatosPdf(doc: RagBrief['formatosDocument']) {
    if (!doc) return;
    const token = sessionStorage.getItem('penalis_auth_token');
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL ?? ''}/api/rag/export/formatos/pdf`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ formatosDocument: doc }),
      },
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'documento-penal.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setRag(null);
    const { data, error: apiError } = await apiFetch<RagResponse>(
      '/api/rag/query',
      {
        method: 'POST',
        body: JSON.stringify({
          question: query,
          mode,
          limit: 10,
          ...(mode === 'audiencia' && { role: audienciaRole }),
          ...(mode === 'debate' && { role: debateRole }),
        }),
      },
    );
    if (apiError) {
      setError(apiError);
    } else if (data) {
      setRag(data);
    }
      setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-deep)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <main
        style={{
          flex: 1,
          padding: 'var(--space-lg)',
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{ marginBottom: 'var(--space-xl)' }}
        >
          <label
            htmlFor="consulta-input"
            style={{
              display: 'block',
              marginBottom: 'var(--space-sm)',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            {modeConfig.label}
          </label>
          {mode === 'audiencia' && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: 'var(--space-md)' }}>Rol procesal:</span>
              <label style={{ marginRight: 'var(--space-lg)', fontSize: '0.9375rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="audiencia-role"
                  checked={audienciaRole === 'defensa'}
                  onChange={() => setAudienciaRole('defensa')}
                  style={{ marginRight: 'var(--space-xs)' }}
                />
                Defensa
              </label>
              <label style={{ fontSize: '0.9375rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="audiencia-role"
                  checked={audienciaRole === 'fiscal'}
                  onChange={() => setAudienciaRole('fiscal')}
                  style={{ marginRight: 'var(--space-xs)' }}
                />
                Fiscal
              </label>
            </div>
          )}
          {mode === 'debate' && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: 'var(--space-md)' }}>Rol procesal:</span>
              <label style={{ marginRight: 'var(--space-lg)', fontSize: '0.9375rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="debate-role"
                  checked={debateRole === 'defensa'}
                  onChange={() => setDebateRole('defensa')}
                  style={{ marginRight: 'var(--space-xs)' }}
                />
                Defensa
              </label>
              <label style={{ fontSize: '0.9375rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="debate-role"
                  checked={debateRole === 'fiscal'}
                  onChange={() => setDebateRole('fiscal')}
                  style={{ marginRight: 'var(--space-xs)' }}
                />
                Fiscal
              </label>
            </div>
          )}
          <textarea
            id="consulta-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={modeConfig.placeholder}
            rows={4}
            disabled={loading}
            style={{
              width: '100%',
              padding: 'var(--space-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '1rem',
              resize: 'vertical',
              minHeight: '120px',
            }}
          />
          <div
            style={{
              marginTop: 'var(--space-md)',
              display: 'flex',
              gap: 'var(--space-md)',
              flexWrap: 'wrap',
            }}
          >
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? (mode === 'audiencia' ? 'Buscando fuentes y generando análisis…' : mode === 'debate' ? 'Buscando fuentes y generando refutación…' : 'Buscando fuentes…') : modeConfig.button}
            </Button>
          </div>
        </form>

        {error && (
          <div
            style={{
              marginBottom: 'var(--space-lg)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--danger-border, #b91c1c)',
              color: 'var(--danger-text, #fecaca)',
              background: 'var(--danger-bg, #450a0a)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {rag && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-xl)',
            }}
          >
            {rag.message && (
              <div
                style={{
                  marginBottom: 'var(--space-lg)',
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--gold-muted, rgba(212, 163, 115, 0.5))',
                  background: 'rgba(212, 163, 115, 0.08)',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {rag.message}
              </div>
            )}
            {mode === 'consulta' && rag.brief?.consulta && (
              <div
                style={{
                  marginBottom: 'var(--space-xl)',
                  padding: 'var(--space-lg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-gold, rgba(212, 163, 115, 0.4))',
                  background: 'rgba(212, 163, 115, 0.06)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    color: 'var(--gold-primary)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  Análisis de consulta jurídica — PENALIS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1) Marco constitucional aplicable</span>
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.consulta.constitutionalFramework || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2) Marco legal relevante</span>
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.consulta.legalFramework || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3) Análisis doctrinal / Teoría General del Delito</span>
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.consulta.doctrinalAnalysis || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>4) Aplicación al caso concreto</span>
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.consulta.applicationToCase || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>5) Conclusión jurídica</span>
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', lineHeight: 1.4, fontWeight: 600 }}>{rag.brief.consulta.conclusion || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>6) Debilidad estratégica de la contraparte</span>
                    <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.consulta.strategicWeakness || '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {mode === 'audiencia' && rag.brief && (
              <div
                style={{
                  marginBottom: 'var(--space-xl)',
                  padding: 'var(--space-lg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-gold, rgba(212, 163, 115, 0.4))',
                  background: 'rgba(212, 163, 115, 0.06)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    color: 'var(--gold-primary)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  Respuesta táctica (Audiencia) — PROMPT MAESTRO
                </h3>
                {rag.brief.maestro ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1) Marco legal aplicable</span>
                      <p className="block-cita block-articulo" style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.maestro.applicableLegalFramework || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2) Análisis técnico procesal</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.maestro.proceduralTechnicalAnalysis || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3) Estrategia de intervención oral</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.maestro.oralInterventionStrategy || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>4) Debilidad estratégica de la contraparte</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.maestro.strategicWeakness || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>5) Riesgos procesales</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.maestro.proceduralRisks || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>6) Recomendación táctica inmediata</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', lineHeight: 1.4, fontWeight: 600 }}>{rag.brief.maestro.immediateTacticalRecommendation || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acción sugerida</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', lineHeight: 1.4 }}>{rag.brief.action}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Artículo</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', fontFamily: 'var(--font-display)', color: 'var(--gold-primary)' }}>{rag.brief.article}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frase procesal</span>
                      <p className="block-cita block-articulo" style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.proceduralPhrase}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'debate' && rag.brief && (
              <div
                style={{
                  marginBottom: 'var(--space-xl)',
                  padding: 'var(--space-lg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-gold, rgba(212, 163, 115, 0.4))',
                  background: 'rgba(212, 163, 115, 0.06)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    color: 'var(--gold-primary)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  Refutación técnica (Debate) — PROMPT MASTER SUPERIOR
                </h3>
                {rag.brief.debateMaster ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1) Identificación de la tesis contraria</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.identificationOfOpposingThesis || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2) Marco legal aplicable</span>
                      <p className="block-cita block-articulo" style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.applicableLegalFramework || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3) Análisis probatorio</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.evidentiaryAnalysis || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>4) Refutación jurídica estructural</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.structuralLegalRefutation || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>5) Vulnerabilidad argumentativa de la contraparte</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.detectedVulnerability || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>6) Estrategia de contraataque</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.counterattackStrategy || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>7) Posible contraargumento de la contraparte</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.possibleCounterargumentOfOpposingParty || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>8) Respuesta preventiva recomendada</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.debateMaster.recommendedPreventiveResponse || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>9) Riesgos procesales</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', lineHeight: 1.4, fontWeight: 600 }}>{rag.brief.debateMaster.proceduralRisks || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tesis</span>
                      <p className="block-cita block-articulo" style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.proceduralPhrase}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundamento</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', fontFamily: 'var(--font-display)', color: 'var(--gold-primary)' }}>{rag.brief.article}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solicitud</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', lineHeight: 1.4 }}>{rag.brief.action}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'formatos' && rag.brief && (
              <div
                style={{
                  marginBottom: 'var(--space-xl)',
                  padding: 'var(--space-lg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-gold, rgba(212, 163, 115, 0.4))',
                  background: 'rgba(212, 163, 115, 0.06)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    color: 'var(--gold-primary)',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  Documento generado (Formatos Penales)
                </h3>
                {rag.brief.formatosDocument ? (
                  <>
                    <div
                      ref={formatosPrintRef}
                      className="formatos-print-area"
                      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}
                    >
                      {rag.brief.formatosDocument.heading && (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encabezado</span>
                          <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.formatosDocument.heading}</p>
                        </div>
                      )}
                      {rag.brief.formatosDocument.identification && (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identificación</span>
                          <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.formatosDocument.identification}</p>
                        </div>
                      )}
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hechos</span>
                        <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.formatosDocument.facts || '—'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundamento jurídico</span>
                        <p className="block-cita block-articulo" style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.formatosDocument.legalBasis || '—'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Petitorio</span>
                        <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{rag.brief.formatosDocument.petition || '—'}</p>
                      </div>
                      {rag.brief.formatosDocument.dateSignature && (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lugar y fecha / Firma</span>
                          <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.formatosDocument.dateSignature}</p>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
                      <Button type="button" variant="secondary" onClick={() => exportFormatosWord(rag.brief?.formatosDocument)}>
                        Exportar a Word
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => exportFormatosPdf(rag.brief?.formatosDocument)}>
                        Exportar a PDF
                      </Button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encabezado</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5 }}>Escrito dirigido al tribunal competente, con fundamento en la normativa indicada en la sección Derecho.</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hechos</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{query.trim() || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Derecho</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', fontFamily: 'var(--font-display)', color: 'var(--gold-primary)' }}>{rag.brief.article}</p>
                      <p className="block-cita block-articulo" style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rag.brief.proceduralPhrase}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Petitorio</span>
                      <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.95rem', lineHeight: 1.4 }}>{rag.brief.action}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {rag.results && rag.results.length > 0 && (
              <div style={{ marginTop: 'var(--space-xl)' }}>
                <button
                  type="button"
                  onClick={() => setShowCitations((v) => !v)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-xs) var(--space-md)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {showCitations ? 'Ocultar citas' : 'Ver citas'}
                </button>
                {showCitations && (
                  <div
                    style={{
                      marginTop: 'var(--space-md)',
                      padding: 'var(--space-md)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)',
                      maxHeight: '40vh',
                      overflowY: 'auto',
                    }}
                  >
                    <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                      Fragmentos recuperados del corpus
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                      {rag.results.map((r, i) => (
                        <li
                          key={r.id}
                          className={r.passedThreshold ? 'block-cita block-articulo' : 'block-cita block-numeral'}
                          style={{
                            padding: 'var(--space-sm)',
                            fontSize: '0.85rem',
                            lineHeight: 1.4,
                          }}
                        >
                          <strong>
                            [{i + 1}] {r.document?.name || r.document?.path || '—'}
                            {r.article ? ` — Art. ${r.article}` : ''}
                          </strong>
                          {r.passedThreshold && (
                            <span style={{ marginLeft: 'var(--space-xs)', fontSize: '0.75rem', color: 'var(--gold-primary)' }}> (umbral)</span>
                          )}
                          <p style={{ margin: 'var(--space-xs) 0 0', whiteSpace: 'pre-wrap' }}>{r.text?.slice(0, 400)}{(r.text?.length ?? 0) > 400 ? '…' : ''}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
