import { useAuthStore } from '../store/auth.store'; // (או איפה שאתה מחזיק token)
import { useConnectivityStore } from '../../../shared/network/connectivity.store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myhomeos.app/api';
const DEFAULT_TIMEOUT_MS = 12000;

type GoogleLoginRes = {
  accessToken: string;
  refreshToken: string;
  user?: any;
  needsOnboarding?: boolean;
};

export async function googleLogin(idToken: string, deviceName?: string): Promise<GoogleLoginRes> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, deviceName }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || `Google login failed (${res.status})`;
    throw new Error(msg);
  }

  // אצלך בשרת זה מחזיר: { accessToken, refreshToken, user, needsOnboarding }
  return json;
}

function withTimeout(signal?: AbortSignal, ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);

  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(id);
      signal?.removeEventListener?.('abort', onAbort);
    },
  };
}

export async function authedFetch(path: string, init: RequestInit = {}) {
  const { isOnline, setServerOk, setServerDown } = useConnectivityStore.getState();

  // אם אין אינטרנט במכשיר -> נחזיר שגיאה "אופליין" בלי לירות רשת
  if (!isOnline) {
    setServerDown('Device offline');
    throw new Error('OFFLINE');
  }

  const token = useAuthStore.getState().accessToken; // תתאים לשם אצלך

  const headers: Record<string, string> = {
    ...(init.headers as any),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (!headers['Content-Type'] && init.body) headers['Content-Type'] = 'application/json';

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const { signal, cleanup } = withTimeout(init.signal ?? undefined, DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, headers, signal });

    // ✅ ברגע שקיבלנו תשובה מהשרת — הוא "נגיש"
    setServerOk();

    // אם השרת מחזיר 5xx הרבה פעמים זה עדיין “server down” לוגית,
    // אבל לפחות יש תקשורת. נשאיר "ok" כי זה reachable.
    return res;
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? '');

    // timeout / network / dns
    if (
      msg.includes('Network request failed') ||
      msg.includes('AbortError') ||
      msg.includes('Failed to fetch')
    ) {
      setServerDown(msg.includes('AbortError') ? 'Timeout' : 'Server unreachable');
    } else {
      setServerDown(msg);
    }

    throw e;
  } finally {
    cleanup();
  }
}

async function fetchJson(path: string, init?: RequestInit) {
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {}),
  };

  const url = `${API_BASE}${path}`;
  console.log('[API] →', init?.method ?? 'GET', url);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(url, {
      ...init,
      headers: mergedHeaders,
      signal: ctrl.signal,
    });

    const text = await res.text();

    // אם קיבלת HTML/טקסט (למשל Cloudflare), שלא יקרוס על JSON.parse
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // נשאיר json null
    }

    if (!res.ok) {
      const msg =
        json?.message ??
        (text?.slice(0, 200) ? `HTTP ${res.status}: ${text.slice(0, 200)}` : `HTTP ${res.status}`);
      throw new Error(msg);
    }

    return json;
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Timeout: השרת לא ענה בזמן (15s)');
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function otpVerify(challengeId: string, code: string, deviceName?: string) {
  return fetchJson('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, code, deviceName }),
  });
}
export async function otpRequest(phoneE164: string) {
  return fetchJson('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phoneE164, channel: 'SMS' }),
  });
}

export async function refreshTokens(refreshToken: string) {
  return fetchJson('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}
