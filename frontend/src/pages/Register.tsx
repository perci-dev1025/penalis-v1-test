import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true);
    const { error: err } = await register(email.trim(), password);
    setLoading(false);
    if (err) { setError(err); return; }
    navigate('/app', { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-lg)', background: 'var(--bg-deep)' }}>
      <Link to="/" style={{ marginBottom: 'var(--space-2xl)' }}><Logo size={40} showText /></Link>
      <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-sm)', textAlign: 'center' }}>Crear cuenta</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', textAlign: 'center', marginBottom: 'var(--space-xl)' }}>Regístrese para usar PENALIS.</p>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ padding: 'var(--space-md)', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', color: 'var(--error-text)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>{error}</div>}
          <label htmlFor="reg-email" style={{ display: 'block', marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Correo electrónico</label>
          <input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} style={{ width: '100%', padding: 'var(--space-md)', marginBottom: 'var(--space-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem' }} />
          <label htmlFor="reg-password" style={{ display: 'block', marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Contraseña (mín. 8 caracteres)</label>
          <input id="reg-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} style={{ width: '100%', padding: 'var(--space-md)', marginBottom: 'var(--space-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem' }} />
          <label htmlFor="reg-confirm" style={{ display: 'block', marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Confirmar contraseña</label>
          <input id="reg-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required disabled={loading} style={{ width: '100%', padding: 'var(--space-md)', marginBottom: 'var(--space-xl)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem' }} />
          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%' }}>{loading ? 'Creando cuenta…' : 'Registrarse'}</Button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-lg)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>¿Ya tiene cuenta? <Link to="/login" style={{ color: 'var(--gold-primary)' }}>Iniciar sesión</Link></p>
      </div>
    </div>
  );
}
