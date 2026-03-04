import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/app';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await login(email.trim(), password);
    setLoading(false);
    if (err) { setError(err); return; }
    navigate(from, { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-lg)', background: 'var(--bg-deep)' }}>
      <Link to="/" style={{ marginBottom: 'var(--space-2xl)' }}><Logo size={40} showText /></Link>
      <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--gold-primary)', marginBottom: 'var(--space-sm)', textAlign: 'center' }}>Iniciar sesión</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', textAlign: 'center', marginBottom: 'var(--space-xl)' }}>Acceda a su cuenta PENALIS.</p>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ padding: 'var(--space-md)', background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', color: 'var(--error-text)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>{error}</div>}
          <label htmlFor="login-email" style={{ display: 'block', marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Correo electrónico</label>
          <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} style={{ width: '100%', padding: 'var(--space-md)', marginBottom: 'var(--space-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem' }} />
          <label htmlFor="login-password" style={{ display: 'block', marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Contraseña</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} style={{ width: '100%', padding: 'var(--space-md)', marginBottom: 'var(--space-xl)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem' }} />
          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%' }}>{loading ? 'Entrando…' : 'Entrar'}</Button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-lg)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>¿No tiene cuenta? <Link to="/register" style={{ color: 'var(--gold-primary)' }}>Registrarse</Link></p>
      </div>
    </div>
  );
}
