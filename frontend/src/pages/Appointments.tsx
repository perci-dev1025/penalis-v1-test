import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { appointmentsApi, type Appointment } from '../services/api';

const TYPE_OPTIONS = [
  { value: '', label: '— Tipo —' },
  { value: 'audiencia', label: 'Audiencia' },
  { value: 'consulta', label: 'Consulta' },
  { value: 'vista', label: 'Vista' },
  { value: 'otro', label: 'Otro' },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function Appointments() {
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await appointmentsApi.list();
    if (e) setError(e);
    else if (data) setList(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const at = scheduledAt ? new Date(scheduledAt).toISOString() : '';
    if (!at) {
      setError('Indique fecha y hora.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: err } = await appointmentsApi.create({
      title: title.trim(),
      scheduledAt: at,
      type: type.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (err) setError(err);
    else if (data) {
      setList((prev) => [...prev, data].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
      setTitle('');
      setScheduledAt('');
      setType('');
      setNotes('');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error: err } = await appointmentsApi.delete(id);
    if (!err) setList((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-deep)',
        padding: 'var(--space-lg)',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <Link
          to="/app"
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9375rem',
            textDecoration: 'none',
            marginBottom: 'var(--space-md)',
            display: 'inline-block',
          }}
        >
          ← Volver al inicio
        </Link>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 4vw, 2rem)',
            color: 'var(--gold-primary)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          Citas
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>
          Gestione sus audiencias, vistas y consultas.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xl)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.125rem',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-md)',
          }}
        >
          Nueva cita
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label htmlFor="apt-title" style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
              Título *
            </label>
            <input
              id="apt-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Audiencia preliminar - Caso X"
              required
              style={{
                width: '100%',
                padding: 'var(--space-sm) var(--space-md)',
                fontSize: '1rem',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label htmlFor="apt-datetime" style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
              Fecha y hora *
            </label>
            <input
              id="apt-datetime"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              style={{
                width: '100%',
                padding: 'var(--space-sm) var(--space-md)',
                fontSize: '1rem',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label htmlFor="apt-type" style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
              Tipo
            </label>
            <select
              id="apt-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-sm) var(--space-md)',
                fontSize: '1rem',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'blank'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="apt-notes" style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
              Notas
            </label>
            <textarea
              id="apt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tribunal, sala, referencia..."
              rows={2}
              style={{
                width: '100%',
                padding: 'var(--space-sm) var(--space-md)',
                fontSize: '1rem',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
          </div>
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? 'Guardando…' : 'Agregar cita'}
          </Button>
        </div>
      </form>

      {error && (
        <div
          style={{
            marginBottom: 'var(--space-md)',
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

      <section>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.125rem',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-md)',
          }}
        >
          Próximas citas
        </h2>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Cargando…</p>
        ) : list.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>No hay citas. Agregue una arriba.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {list.map((apt) => (
              <li
                key={apt.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 'var(--space-md)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}>
                    {apt.title}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gold-primary)' }}>
                    {formatDateTime(apt.scheduledAt)}
                  </div>
                  {apt.type && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'capitalize', marginTop: 'var(--space-xs)' }}>
                      {apt.type}
                    </div>
                  )}
                  {apt.notes && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)', whiteSpace: 'pre-wrap' }}>
                      {apt.notes}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(apt.id)}
                  style={{
                    padding: 'var(--space-xs) var(--space-sm)',
                    fontSize: '0.8125rem',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
