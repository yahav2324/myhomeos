let accessToken: string | null = null;

export function setToken(t: string | null) {
  accessToken = t;
}

async function req(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as any),
  };

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    const msg = json?.errors?.formErrors?.[0] ?? json?.message ?? 'Request failed';
    throw new Error(msg);
  }
  return json;
}

export const api = {
  // כאן תחבר ל-endpoints של ה-auth שלך (OTP) — אני משאיר placeholders.
  // אתה פשוט תחליף לנתיבים האמיתיים של auth אצלך.
  async startOtp(phoneE164: string) {
    // לפי הקונטרולר שלך:
    // POST /auth/otp/request  body: { phoneE164 }
    return req(`/auth/otp/request`, {
      method: 'POST',
      body: JSON.stringify({ phoneE164 }),
    });
  },

  async verifyOtp(challengeId: string, code: string) {
    // לפי הקונטרולר שלך:
    // POST /auth/otp/verify body: { challengeId, code }
    return req(`/auth/otp/verify`, {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
    });
  },

  async getConfig() {
    return req(`/admin/catalog/config`);
  },
  async patchConfig(body: any) {
    return req(`/admin/catalog/config`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  async listTerms(params: { status?: string; lang?: string; q?: string }) {
    const qs = new URLSearchParams(params as any).toString();
    return req(`/admin/terms?${qs}`);
  },
  async approve(termId: string) {
    return req(`/admin/terms/${termId}/approve`, { method: 'PATCH' });
  },
  async reject(termId: string) {
    return req(`/admin/terms/${termId}/reject`, { method: 'PATCH' });
  },
};
