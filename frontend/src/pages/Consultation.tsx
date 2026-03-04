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
  // Formatos (document generation) structured fields
  const [formatosRole, setFormatosRole] = useState<'fiscal' | 'defensa' | 'querellante' | 'victima'>('defensa');
  const [formatosDocumentType, setFormatosDocumentType] = useState('');
  const [formatosStage, setFormatosStage] = useState('');
  const [formatosCourt, setFormatosCourt] = useState('');
  const [formatosCaseNumber, setFormatosCaseNumber] = useState('');
  const [formatosOffense, setFormatosOffense] = useState('');
  const [formatosFacts, setFormatosFacts] = useState('');
  const [formatosPurpose, setFormatosPurpose] = useState('');
  const [formatosEvidence, setFormatosEvidence] = useState('');
  const [formatosParties, setFormatosParties] = useState('');
  const [audienciaRole, setAudienciaRole] = useState<'defensa' | 'fiscal'>('defensa');
  const [debateRole, setDebateRole] = useState<'defensa' | 'fiscal'>('defensa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rag, setRag] = useState<RagResponse | null>(null);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const formatosPrintRef = useRef<HTMLDivElement>(null);

  /** Build full strategic text for TTS (Consulta, Audiencia, Debate only). */
  function getStrategicTextForTTS(m: string, brief: RagBrief | undefined): string {
    if (!brief) return '';
    const parts: string[] = [];
    if (m === 'consulta' && brief.consulta) {
      const c = brief.consulta;
      parts.push('Marco constitucional aplicable.', c.constitutionalFramework || '');
      parts.push('Marco legal relevante.', c.legalFramework || '');
      parts.push('Análisis doctrinal.', c.doctrinalAnalysis || '');
      parts.push('Aplicación al caso concreto.', c.applicationToCase || '');
      parts.push('Conclusión jurídica.', c.conclusion || '');
      parts.push('Debilidad estratégica de la contraparte.', c.strategicWeakness || '');
    } else if (m === 'audiencia' && brief.maestro) {
      const x = brief.maestro;
      parts.push('Tesis y análisis técnico procesal.', x.proceduralTechnicalAnalysis || '');
      parts.push('Fundamento jurídico integrado.', x.applicableLegalFramework || '');
      parts.push('Estrategia de intervención oral.', x.oralInterventionStrategy || '');
      parts.push('Posible contraargumento de la contraparte.', x.strategicWeakness || '');
      parts.push('Riesgos procesales.', x.proceduralRisks || '');
      parts.push('Recomendación táctica inmediata.', x.immediateTacticalRecommendation || '');
    } else if (m === 'debate' && brief.debateMaster) {
      const d = brief.debateMaster;
      parts.push('Tesis.', d.identificationOfOpposingThesis || '');
      parts.push('Integración de normas.', d.applicableLegalFramework || '');
      parts.push('Análisis probatorio.', d.evidentiaryAnalysis || '');
      parts.push('Refutación técnica.', d.structuralLegalRefutation || '');
      parts.push('Error técnico de la contraparte.', d.detectedVulnerability || '');
      parts.push('Estrategia de contraataque.', d.counterattackStrategy || '');
      parts.push('Posible contraargumento de la contraparte.', d.possibleCounterargumentOfOpposingParty || '');
      parts.push('Respuesta preventiva recomendada.', d.recommendedPreventiveResponse || '');
      parts.push('Riesgos procesales y conclusión estratégica.', d.proceduralRisks || '');
    }
    return parts.filter(Boolean).join(' ');
  }

  function handlePlayTTS() {
    const text = getStrategicTextForTTS(mode, rag?.brief);
    if (!text.trim()) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-VE';
    u.rate = 0.95;
    u.onend = () => setTtsSpeaking(false);
    u.onerror = () => setTtsSpeaking(false);
    window.speechSynthesis.speak(u);
    setTtsSpeaking(true);
  }

  function handleStopTTS() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setTtsSpeaking(false);
    }
  }

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
    if (mode === 'formatos') {
      // Require minimal structured data for Formatos mode before sending the query.
      if (
        !formatosDocumentType.trim() ||
        !formatosStage.trim() ||
        !formatosCourt.trim() ||
        !formatosFacts.trim() ||
        !formatosPurpose.trim() ||
        !formatosParties.trim()
      ) {
        setError('Complete al menos: tipo de escrito, etapa procesal, tribunal competente, hechos relevantes, finalidad del escrito e identificación de las partes.');
        return;
      }
    } else if (!query.trim()) {
      return;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setTtsSpeaking(false);
    }
    setLoading(true);
    setError(null);
    setRag(null);
    let questionPayload = query;
    if (mode === 'formatos') {
      const roleLabel =
        formatosRole === 'fiscal'
          ? 'Fiscal'
          : formatosRole === 'querellante'
          ? 'Querellante'
          : formatosRole === 'victima'
          ? 'Víctima'
          : 'Defensa';
      questionPayload = [
        `Rol procesal: ${roleLabel}`,
        `Tipo de escrito: ${formatosDocumentType}`,
        `Etapa procesal: ${formatosStage}`,
        `Tribunal competente: ${formatosCourt}`,
        formatosCaseNumber.trim() ? `Identificación del caso: ${formatosCaseNumber}` : '',
        formatosOffense.trim() ? `Delito imputado: ${formatosOffense}` : '',
        `Hechos relevantes: ${formatosFacts}`,
        `Finalidad del escrito: ${formatosPurpose}`,
        formatosEvidence.trim() ? `Pruebas disponibles: ${formatosEvidence}` : '',
        `Identificación de las partes: ${formatosParties}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    const { data, error: apiError } = await apiFetch<RagResponse>(
      '/api/rag/query',
      {
        method: 'POST',
        body: JSON.stringify({
          question: questionPayload,
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
          {mode === 'formatos' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 'var(--space-md)',
              }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Rol procesal
                </label>
                <select
                  value={formatosRole}
                  onChange={(e) =>
                    setFormatosRole(e.target.value as 'fiscal' | 'defensa' | 'querellante' | 'victima')
                  }
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                >
                  <option value="defensa">Defensa</option>
                  <option value="fiscal">Fiscal</option>
                  <option value="querellante">Querellante</option>
                  <option value="victima">Víctima</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Tipo de escrito
                </label>
                <input
                  type="text"
                  value={formatosDocumentType}
                  onChange={(e) => setFormatosDocumentType(e.target.value)}
                  disabled={loading}
                  placeholder="p.ej. Solicitud de sustitución de medida, Recurso, etc."
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Etapa procesal
                </label>
                <input
                  type="text"
                  value={formatosStage}
                  onChange={(e) => setFormatosStage(e.target.value)}
                  disabled={loading}
                  placeholder="Investigación, fase intermedia, juicio oral, ejecución…"
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Tribunal competente
                </label>
                <input
                  type="text"
                  value={formatosCourt}
                  onChange={(e) => setFormatosCourt(e.target.value)}
                  disabled={loading}
                  placeholder="Tribunal de Control de…, Corte de Apelaciones de…"
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Identificación del caso (expediente)
                </label>
                <input
                  type="text"
                  value={formatosCaseNumber}
                  onChange={(e) => setFormatosCaseNumber(e.target.value)}
                  disabled={loading}
                  placeholder="Número de expediente (opcional)"
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Delito imputado (si aplica)
                </label>
                <input
                  type="text"
                  value={formatosOffense}
                  onChange={(e) => setFormatosOffense(e.target.value)}
                  disabled={loading}
                  placeholder="p.ej. Robo agravado, homicidio intencional…"
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Hechos relevantes
                </label>
                <textarea
                  value={formatosFacts}
                  onChange={(e) => setFormatosFacts(e.target.value)}
                  disabled={loading}
                  rows={4}
                  placeholder="Describa de forma clara y sintética los hechos relevantes para el escrito."
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
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Finalidad del escrito
                </label>
                <textarea
                  value={formatosPurpose}
                  onChange={(e) => setFormatosPurpose(e.target.value)}
                  disabled={loading}
                  rows={3}
                  placeholder="¿Qué se pretende con el escrito? (p.ej. solicitar sustitución de medida, interponer recurso, etc.)"
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
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Pruebas disponibles (si aplica)
                </label>
                <textarea
                  value={formatosEvidence}
                  onChange={(e) => setFormatosEvidence(e.target.value)}
                  disabled={loading}
                  rows={3}
                  placeholder="Enumere brevemente los medios de prueba relevantes (opcional)."
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
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Identificación de las partes
                </label>
                <textarea
                  value={formatosParties}
                  onChange={(e) => setFormatosParties(e.target.value)}
                  disabled={loading}
                  rows={3}
                  placeholder="Tribunal, partes, representación, víctimas, etc."
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
                  }}
                />
              </div>
            </div>
          ) : (
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
          )}
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
            className="penalis-result-document"
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
                  border: '1px solid var(--border-gold)',
                  background: 'var(--gold-message-bg)',
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
                  border: '1px solid var(--border-gold)',
                  background: 'var(--gold-card-bg)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-gold)', paddingBottom: 'var(--space-sm)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', color: 'var(--gold-primary)', margin: 0 }}>
                    Análisis de consulta jurídica
                  </h3>
                  {ttsSpeaking ? (
                    <Button type="button" variant="secondary" onClick={handleStopTTS} aria-label="Detener reproducción">
                      Detener
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" onClick={handlePlayTTS} aria-label="Escuchar análisis">
                      Escuchar análisis
                    </Button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                  <section>
                    <h4 className="penalis-doc-section-title">Marco constitucional aplicable</h4>
                    <p className="penalis-doc-body">{rag.brief.consulta.constitutionalFramework || '—'}</p>
                  </section>
                  <section>
                    <h4 className="penalis-doc-section-title">Marco legal relevante</h4>
                    <p className="penalis-doc-body">{rag.brief.consulta.legalFramework || '—'}</p>
                  </section>
                  <section>
                    <h4 className="penalis-doc-section-title">Análisis doctrinal / Teoría General del Delito</h4>
                    <p className="penalis-doc-body">{rag.brief.consulta.doctrinalAnalysis || '—'}</p>
                  </section>
                  <section>
                    <h4 className="penalis-doc-section-title">Aplicación al caso concreto</h4>
                    <p className="penalis-doc-body">{rag.brief.consulta.applicationToCase || '—'}</p>
                  </section>
                  <section>
                    <h4 className="penalis-doc-section-title">Conclusión jurídica</h4>
                    <p className="penalis-doc-body penalis-doc-conclusion">{rag.brief.consulta.conclusion || '—'}</p>
                  </section>
                  <section>
                    <h4 className="penalis-doc-section-title">Debilidad estratégica de la contraparte</h4>
                    <p className="penalis-doc-body">{rag.brief.consulta.strategicWeakness || '—'}</p>
                  </section>
                </div>
              </div>
            )}

            {mode === 'audiencia' && rag.brief && (
              <div
                style={{
                  marginBottom: 'var(--space-xl)',
                  padding: 'var(--space-lg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-gold)',
                  background: 'var(--gold-card-bg)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-gold)', paddingBottom: 'var(--space-sm)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', color: 'var(--gold-primary)', margin: 0 }}>
                    Respuesta táctica (Audiencia)
                  </h3>
                  {rag.brief.maestro && (ttsSpeaking ? (
                    <Button type="button" variant="secondary" onClick={handleStopTTS} aria-label="Detener reproducción">
                      Detener
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" onClick={handlePlayTTS} aria-label="Escuchar análisis">
                      Escuchar análisis
                    </Button>
                  ))}
                </div>
                {rag.brief.maestro ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    <section>
                      <h4 className="penalis-doc-section-title">Tesis / Análisis técnico procesal</h4>
                      <p className="penalis-doc-body">{rag.brief.maestro.proceduralTechnicalAnalysis || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Fundamento jurídico integrado</h4>
                      <p className="block-cita block-articulo penalis-doc-body">{rag.brief.maestro.applicableLegalFramework || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Estrategia de intervención oral</h4>
                      <p className="penalis-doc-body">{rag.brief.maestro.oralInterventionStrategy || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Posible contraargumento de la contraparte</h4>
                      <p className="penalis-doc-body">{rag.brief.maestro.strategicWeakness || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Riesgos procesales</h4>
                      <p className="penalis-doc-body">{rag.brief.maestro.proceduralRisks || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Recomendación táctica inmediata</h4>
                      <p className="penalis-doc-body penalis-doc-conclusion">{rag.brief.maestro.immediateTacticalRecommendation || '—'}</p>
                    </section>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <section>
                      <h4 className="penalis-doc-section-title">Acción sugerida</h4>
                      <p className="penalis-doc-body">{rag.brief.action}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Artículo</h4>
                      <p className="penalis-doc-body" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-primary)' }}>{rag.brief.article}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Frase procesal</h4>
                      <p className="block-cita block-articulo penalis-doc-body">{rag.brief.proceduralPhrase}</p>
                    </section>
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
                  border: '1px solid var(--border-gold)',
                  background: 'var(--gold-card-bg)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-gold)', paddingBottom: 'var(--space-sm)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', color: 'var(--gold-primary)', margin: 0 }}>
                    Refutación técnica (Debate)
                  </h3>
                  {rag.brief.debateMaster && (ttsSpeaking ? (
                    <Button type="button" variant="secondary" onClick={handleStopTTS} aria-label="Detener reproducción">
                      Detener
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" onClick={handlePlayTTS} aria-label="Escuchar análisis">
                      Escuchar análisis
                    </Button>
                  ))}
                </div>
                {rag.brief.debateMaster ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    <section>
                      <h4 className="penalis-doc-section-title">Tesis</h4>
                      <p className="penalis-doc-body">{rag.brief.debateMaster.identificationOfOpposingThesis || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Integración de normas</h4>
                      <p className="block-cita block-articulo penalis-doc-body">{rag.brief.debateMaster.applicableLegalFramework || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Análisis probatorio</h4>
                      <p className="penalis-doc-body">{rag.brief.debateMaster.evidentiaryAnalysis || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Refutación técnica</h4>
                      <p className="penalis-doc-body">{rag.brief.debateMaster.structuralLegalRefutation || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Error técnico de la contraparte</h4>
                      <p className="penalis-doc-body">{rag.brief.debateMaster.detectedVulnerability || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Estrategia de contraataque</h4>
                      <p className="penalis-doc-body">{rag.brief.debateMaster.counterattackStrategy || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Posible contraargumento de la contraparte</h4>
                      <p className="penalis-doc-body">{rag.brief.debateMaster.possibleCounterargumentOfOpposingParty || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Respuesta preventiva recomendada</h4>
                      <p className="penalis-doc-body">{rag.brief.debateMaster.recommendedPreventiveResponse || '—'}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Riesgos procesales / Conclusión estratégica</h4>
                      <p className="penalis-doc-body penalis-doc-conclusion">{rag.brief.debateMaster.proceduralRisks || '—'}</p>
                    </section>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <section>
                      <h4 className="penalis-doc-section-title">Tesis</h4>
                      <p className="block-cita block-articulo penalis-doc-body">{rag.brief.proceduralPhrase}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Fundamento</h4>
                      <p className="penalis-doc-body" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-primary)' }}>{rag.brief.article}</p>
                    </section>
                    <section>
                      <h4 className="penalis-doc-section-title">Solicitud</h4>
                      <p className="penalis-doc-body">{rag.brief.action}</p>
                    </section>
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
                  border: '1px solid var(--border-gold)',
                  background: 'var(--gold-card-bg)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.125rem',
                    color: 'var(--gold-primary)',
                    marginBottom: 'var(--space-lg)',
                    borderBottom: '1px solid var(--border-gold)',
                    paddingBottom: 'var(--space-sm)',
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
                        <section>
                          <h4 className="penalis-doc-section-title">Encabezado</h4>
                          <p className="penalis-doc-body">{rag.brief.formatosDocument.heading}</p>
                        </section>
                      )}
                      {rag.brief.formatosDocument.identification && (
                        <section>
                          <h4 className="penalis-doc-section-title">Identificación</h4>
                          <p className="penalis-doc-body">{rag.brief.formatosDocument.identification}</p>
                        </section>
                      )}
                      <section>
                        <h4 className="penalis-doc-section-title">Hechos</h4>
                        <p className="penalis-doc-body">{rag.brief.formatosDocument.facts || '—'}</p>
                      </section>
                      <section>
                        <h4 className="penalis-doc-section-title">Fundamento jurídico</h4>
                        <p className="block-cita block-articulo penalis-doc-body">{rag.brief.formatosDocument.legalBasis || '—'}</p>
                      </section>
                      <section>
                        <h4 className="penalis-doc-section-title">Petitorio</h4>
                        <p className="penalis-doc-body">{rag.brief.formatosDocument.petition || '—'}</p>
                      </section>
                      {rag.brief.formatosDocument.dateSignature && (
                        <section>
                          <h4 className="penalis-doc-section-title">Lugar y fecha / Firma</h4>
                          <p className="penalis-doc-body">{rag.brief.formatosDocument.dateSignature}</p>
                        </section>
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

          </div>
        )}
      </main>
    </div>
  );
}
