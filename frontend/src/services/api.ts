export const API_BASE = import.meta.env.VITE_BACKEND_URL ?? '';

const AUTH_TOKEN_KEY = 'penalis_auth_token';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function getOptions(init?: RequestInit): RequestInit {
  const token = getStoredToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init?.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return {
    credentials: 'include',
    headers,
    ...init,
  };
}

export type User = {
  id: string;
  email: string;
  role: string;
  plan_id: string | null;
  status: string;
};

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string; status: number }> {
  const res = await fetch(`${API_BASE}${path}`, getOptions(options));
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text || 'Error desconocido' };
    }
  }
  const obj = body as { error?: string; user?: User };
  if (!res.ok) {
    return {
      error: obj?.error ?? `Error ${res.status}`,
      status: res.status,
    };
  }
  return { data: body as T, status: res.status };
}

export const authApi = {
  me: () => apiFetch<{ user: User }>('/api/auth/me'),
  login: (email: string, password: string) =>
    apiFetch<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    apiFetch<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
};

export type Appointment = {
  id: string;
  userId: string;
  title: string;
  scheduledAt: string;
  type: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const appointmentsApi = {
  list: () => apiFetch<Appointment[]>('/api/appointments'),
  create: (body: { title: string; scheduledAt: string; type?: string; notes?: string }) =>
    apiFetch<Appointment>('/api/appointments', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => apiFetch<Appointment>(`/api/appointments/${id}`),
  update: (id: string, body: Partial<{ title: string; scheduledAt: string; type: string; notes: string }>) =>
    apiFetch<Appointment>(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/appointments/${id}`, { method: 'DELETE' }),
};
