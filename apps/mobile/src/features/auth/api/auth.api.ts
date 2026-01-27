import { emitAuthRequired } from '../auth.events';
import { getTokens, saveTokens, clearTokens } from '../auth.tokens';

const API_BASE = process.env.API_BASE_URL ?? 'http://192.168.1.173:3000/api';

async function fetchJson(path: string, init?: RequestInit) {
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: mergedHeaders,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return json;
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
