import { useState } from 'react';
import { Button } from '../components/Button';

export function Consultation() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResponse(null);
    setTimeout(() => {
      setResponse('Respuesta de ejemplo. En producción aquí se mostrará la respuesta del sistema RAG con citación literal verificable (artículo, numeral, jurisprudencia) según el modo seleccionado.');
      setLoading(false);
    }, 1200);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: 'var(--space-lg)', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-xl)' }}>
          <label htmlFor="consulta-input" style={{ display: 'block', marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Consulta</label>
          <textarea
            id="consulta-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Redacte su consulta jurídica..."
            rows={4}
            disabled={loading}
            style={{ width: '100%', padding: 'var(--space-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical', minHeight: '120px' }}
          />
          <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Generando…' : 'Generar respuesta'}</Button>
          </div>
        </form>
        {response && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-md)' }}>Respuesta estructurada</h3>
            <div className="block-cita block-articulo" style={{ marginBottom: 'var(--space-lg)' }}>{response}</div>
            <Button variant="secondary" type="button">Escuchar respuesta</Button>
          </div>
        )}
      </main>
    </div>
  );
}
