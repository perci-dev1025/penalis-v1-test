import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type User } from '../services/api';

type AuthState = {
  user: User | null;
  loading: boolean;
  checked: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    checked: false,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const { data } = await authApi.me();
    setState({
      user: data?.user ?? null,
      loading: false,
      checked: true,
    });
    return;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await authApi.login(email, password);
      if (error) return { error };
      setState({
        user: data!.user,
        loading: false,
        checked: true,
      });
      return {};
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await authApi.register(email, password);
      if (error) return { error };
      setState({
        user: data!.user,
        loading: false,
        checked: true,
      });
      return {};
    },
    []
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setState({ user: null, loading: false, checked: true });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      refresh,
    }),
    [state, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
