import { emitAuthRequired } from '../auth.events';
import { getTokens, saveTokens, clearTokens } from '../auth.tokens';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myhomeos.app/api';

export async function googleLogin(idToken: string, deviceName?: string) {
  return fetchJson('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, deviceName }),
  });
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

export async function otpRequest(phoneE164: string) {
  return fetchJson('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phoneE164, channel: 'SMS' }),
  });
}

export async function otpVerify(challengeId: string, code: string, deviceName?: string) {
  return fetchJson('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, code, deviceName }),
  });
}

export async function refreshTokens(refreshToken: string) {
  return fetchJson('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function authedFetch(path: string, init?: RequestInit) {
  const { accessToken, refreshToken } = await getTokens();

  const doReq = async (token: string | null) => {
    const mergedHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    };

    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: mergedHeaders,
    });
  };

  let res = await doReq(accessToken);
  if (res.status !== 401) return res;

  try {
    if (!refreshToken) {
      await clearTokens();
      emitAuthRequired();
      return res;
    }
    const refreshed = await refreshTokens(refreshToken);
    await saveTokens(refreshed.accessToken, refreshed.refreshToken);
    res = await doReq(refreshed.accessToken);
    return res;
  } catch {
    await clearTokens();
    emitAuthRequired();
    return res;
  }
}
