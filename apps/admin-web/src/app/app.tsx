import React from 'react';
import { api, setToken } from '../api';

type Term = {
  id: string;
  text: string;
  status: string;
  upCount: number;
  downCount: number;
};

export default function App() {
  const [token, _setToken] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'config' | 'review'>('config');

  // auth states
  const [phone, setPhone] = React.useState('');
  const [challengeId, setChallengeId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);

  // config states
  const [cfg, setCfg] = React.useState<any>(null);

  // review states
  const [terms, setTerms] = React.useState<Term[]>([]);
  const [status, setStatus] = React.useState('PENDING');
  const [lang, setLang] = React.useState('he');
  const [q, setQ] = React.useState('');

  const loggedIn = !!token;

  async function loginStart() {
    setErr(null);
    const res = await api.startOtp(phone.trim());
    setChallengeId(res.data?.challengeId ?? res.challengeId ?? '');
  }

  async function loginVerify() {
    setErr(null);
    const res = await api.verifyOtp(challengeId, code.trim());
    const t = res?.data?.accessToken ?? res?.accessToken ?? res?.data?.tokens?.accessToken;

    if (!t) throw new Error('Missing accessToken from /auth/otp/verify response');
    setToken(t);
    _setToken(t);
    await loadConfig();
    await loadTerms();
  }

  async function loadConfig() {
    const res = await api.getConfig();
    setCfg(res.data);
  }

  async function saveConfig() {
    const res = await api.patchConfig(cfg);
    setCfg(res.data);
  }

  async function loadTerms() {
    const res = await api.listTerms({ status, lang, q });
    setTerms(res.data.items);
  }

  async function act(termId: string, action: 'approve' | 'reject') {
    if (action === 'approve') await api.approve(termId);
    else await api.reject(termId);

    // remove from UI (flow)
    setTerms((t) => t.filter((x) => x.id !== termId));
  }

  if (!loggedIn) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h2>SmartKitchen Admin</h2>
        {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}

        <div style={{ marginTop: 12 }}>
          <input
            placeholder="Phone E164 e.g. +9725..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ padding: 10, width: 280 }}
          />
          <button
            onClick={() => loginStart().catch((e) => setErr(e.message))}
            style={{ marginLeft: 8, padding: 10 }}
          >
            Send OTP
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            placeholder="ChallengeId"
            value={challengeId}
            onChange={(e) => setChallengeId(e.target.value)}
            style={{ padding: 10, width: 280 }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            placeholder="OTP Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ padding: 10, width: 140 }}
          />
          <button
            onClick={() => loginVerify().catch((e) => setErr(e.message))}
            style={{ marginLeft: 8, padding: 10 }}
          >
            Verify
          </button>
        </div>

        <p style={{ marginTop: 16, opacity: 0.7 }}>
          חשוב: השרת חייב לסמן את המשתמש שלך כ־isAdmin=true.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>SmartKitchen Admin</h2>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button onClick={() => setTab('config')}>Config</button>
        <button onClick={() => setTab('review')}>Review</button>
        <button
          onClick={() => {
            setToken(null);
            _setToken(null);
          }}
        >
          Logout
        </button>
      </div>

      {tab === 'config' ? (
        <div style={{ marginTop: 20, maxWidth: 420 }}>
          <h3>Catalog thresholds</h3>
          {!cfg ? <button onClick={() => loadConfig()}>Load</button> : null}

          {cfg ? (
            <>
              <label>minQueryChars</label>
              <input
                type="number"
                value={cfg.minQueryChars}
                onChange={(e) => setCfg({ ...cfg, minQueryChars: Number(e.target.value) })}
                style={{ width: '100%', padding: 10, marginBottom: 10 }}
              />

              <label>upApproveMin</label>
              <input
                type="number"
                value={cfg.upApproveMin}
                onChange={(e) => setCfg({ ...cfg, upApproveMin: Number(e.target.value) })}
                style={{ width: '100%', padding: 10, marginBottom: 10 }}
              />

              <label>downRejectMin</label>
              <input
                type="number"
                value={cfg.downRejectMin}
                onChange={(e) => setCfg({ ...cfg, downRejectMin: Number(e.target.value) })}
                style={{ width: '100%', padding: 10, marginBottom: 10 }}
              />

              <button
                onClick={() => saveConfig().catch((e) => alert(e.message))}
                style={{ padding: 10 }}
              >
                Save
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <h3>Terms review</h3>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>

            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="he">he</option>
              <option value="en">en</option>
            </select>

            <input placeholder="search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button onClick={() => loadTerms().catch((e) => alert(e.message))}>Load</button>
          </div>

          <div style={{ display: 'grid', gap: 10, maxWidth: 800 }}>
            {terms.map((t) => (
              <div key={t.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{t.text}</div>
                    <div style={{ opacity: 0.7 }}>
                      {t.status} · UP {t.upCount} / DOWN {t.downCount}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => act(t.id, 'approve').catch((e) => alert(e.message))}>
                      ✅ Approve
                    </button>
                    <button onClick={() => act(t.id, 'reject').catch((e) => alert(e.message))}>
                      ❌ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {terms.length === 0 ? <div style={{ opacity: 0.7 }}>No items</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
