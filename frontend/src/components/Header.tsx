import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';

const MODE_LABELS: Record<string, string> = {
  audiencia: 'Modo Audiencia',
  debate: 'Modo Debate Oral',
  consulta: 'Modo Consulta Jurídica',
  formatos: 'Modo Formatos Penales',
};

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-md)',
  padding: 'var(--space-md) var(--space-lg)',
  background: 'var(--bg-surface)',
  borderBottom: '1px solid var(--border)',
  flexWrap: 'wrap',
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-lg)',
  flexWrap: 'wrap',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.9375rem',
  textDecoration: 'none',
};
const linkHover = 'var(--gold-primary)';

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '0.9375rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pathname = location.pathname;
  const isLanding = pathname === '/';
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isApp = pathname.startsWith('/app');
  const isConsultation = pathname.startsWith('/app/consulta');

  const modeId = isConsultation
    ? new URLSearchParams(location.search).get('mode') || 'consulta'
    : null;
  const modeLabel = modeId ? MODE_LABELS[modeId] ?? MODE_LABELS.consulta : null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={headerStyle}>
      <Link to={user ? '/app' : '/'} style={{ display: 'flex' }} aria-label="PENALIS inicio">
        <Logo size={36} showText />
      </Link>

      <nav style={navStyle}>
        {isLanding && !user && (
          <>
            <Link to="/login" style={linkStyle}>
              Iniciar sesión
            </Link>
            <Link to="/register" style={{ ...linkStyle, color: 'var(--gold-primary)', fontWeight: 600 }}>
              Registrarse
            </Link>
          </>
        )}

        {isLanding && user && (
          <Link to="/app" style={{ ...linkStyle, color: 'var(--gold-primary)' }}>
            Ir a la app
          </Link>
        )}

        {isAuthPage && (
          <Link to="/" style={linkStyle}>
            Volver al inicio
          </Link>
        )}

        {isApp && user && (
          <>
            {isConsultation && (
              <>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--gold-primary)',
                    fontWeight: 600,
                  }}
                >
                  {modeLabel}
                </span>
                <Link to="/app" style={linkStyle}>
                  Cambiar modo
                </Link>
              </>
            )}
            <Link to="/app/citas" style={linkStyle}>
              Citas
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              style={buttonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = linkHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Cerrar sesión
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
