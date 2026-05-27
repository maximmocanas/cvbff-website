// CvBFF — Supabase helpers (web version — uses localStorage store instead of chrome.storage).
// Requires config.js (SUPABASE_URL, SUPABASE_ANON) and app.js (store) loaded first.

const _SESSION_KEY = "supabaseSession";

function _fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .then(res => { clearTimeout(timer); return res; })
    .catch(err => {
      clearTimeout(timer);
      if (err.name === "AbortError") throw new Error("Request timed out — check your connection and try again.");
      throw err;
    });
}

// ── Auth rate limiting (client-side) ─────────────────────────────────────
const _RL_KEY    = "authRateLimit";
const _RL_MAX    = 5;
const _RL_WINDOW = 15 * 60 * 1000;

async function _checkAuthRate() {
  const raw  = await store.get(_RL_KEY);
  const data = raw[_RL_KEY] || { attempts: [] };
  const now  = Date.now();
  data.attempts = (data.attempts || []).filter(ts => now - ts < _RL_WINDOW);
  if (data.attempts.length >= _RL_MAX) {
    const unlocksAt = data.attempts[0] + _RL_WINDOW;
    const minsLeft  = Math.max(1, Math.ceil((unlocksAt - now) / 60000));
    throw new Error(`Too many sign-in attempts. Please wait ${minsLeft} minute${minsLeft !== 1 ? "s" : ""} before trying again.`);
  }
  data.attempts.push(now);
  await store.set({ [_RL_KEY]: data });
}

async function _clearAuthRate() {
  await store.remove(_RL_KEY).catch(() => {});
}

async function _readSession() {
  const s = await store.get(_SESSION_KEY);
  return s[_SESSION_KEY] || null;
}

async function _storeSession(data) {
  const session = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
  };
  await store.set({ [_SESSION_KEY]: session });
  return session;
}

const _authHeaders = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON,
  "Authorization": `Bearer ${SUPABASE_ANON}`,
});

async function _refreshSession(refreshToken) {
  const res = await _fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: _authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    await store.remove(_SESSION_KEY).catch(() => {});
    throw new Error("Session expired — please sign in again.");
  }
  return _storeSession(await res.json());
}

async function ensureSession() {
  const s = await _readSession();
  if (!s) throw new Error("Not signed in.");
  if (s.expires_at - Date.now() / 1000 < 60) return _refreshSession(s.refresh_token);
  return s;
}

// ---------- Auth ----------

async function signUp(email, password) {
  await _checkAuthRate();
  const res = await _fetchWithTimeout(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: _authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || data.error || `Sign up failed (${res.status})`);
  await _clearAuthRate();
  return _storeSession(data);
}

async function signIn(email, password) {
  await _checkAuthRate();
  const res = await _fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: _authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || data.error || `Sign in failed (${res.status})`);
  await _clearAuthRate();
  return _storeSession(data);
}

// Web OAuth: redirect to Supabase → auth-callback.html picks up tokens from URL hash.
function signInWithGoogle() {
  const redirectTo = encodeURIComponent("https://cvbff.com/app/auth-callback.html");
  location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  return new Promise(() => {}); // never resolves — page navigates away
}

async function forgotPassword(email) {
  const res = await _fetchWithTimeout(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: _authHeaders(),
    body: JSON.stringify({ email, redirect_to: "https://cvbff.com/reset" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error_description || data.message || "Failed to send reset email — please try again.");
  }
}

async function signOut() {
  const s = await _readSession().catch(() => null);
  if (s) {
    await _fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { ..._authHeaders(), "Authorization": `Bearer ${s.access_token}` },
    }).catch(() => {});
  }
  await store.remove(_SESSION_KEY);
}

async function getUser() {
  const s = await _readSession().catch(() => null);
  if (!s) return null;
  try {
    const payload = JSON.parse(atob(s.access_token.split(".")[1]));
    return { email: payload.email || null, id: payload.sub };
  } catch { return null; }
}

// Authenticated fetch wrapper for Supabase REST API.
async function _sbFetch(path, options = {}) {
  const session = await ensureSession();
  const res = await _fetchWithTimeout(`${SUPABASE_API_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Supabase error (${res.status})`);
  }
  return res;
}

// ---------- Credits ----------

async function getCredits() {
  try {
    const res = await _sbFetch("/profiles?select=credits&limit=1");
    const rows = await res.json();
    return typeof rows[0]?.credits === "number" ? rows[0].credits : 0;
  } catch { return 0; }
}

// ---------- Profile ----------

async function saveProfile(data) {
  await _sbFetch("/profiles", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
}

async function loadProfile() {
  const res = await _sbFetch("/profiles?select=data&limit=1");
  const rows = await res.json();
  return rows[0]?.data || null;
}

// ---------- Applications ----------

async function saveApplication(data) {
  const res = await _sbFetch("/applications", {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify(data),
  });
  const rows = await res.json();
  return rows[0]?.id || null;
}

async function getApplications() {
  const res = await _sbFetch("/applications?select=*&order=created_at.desc");
  return res.json();
}

async function deleteApplication(id) {
  await _sbFetch(`/applications?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function updateApplication(id, data) {
  await _sbFetch(`/applications?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify(data),
  });
}

// ---------- Payments ----------

const _VALID_PACKAGES = new Set(["pack_10", "pack_30", "pack_65", "pack_100"]);

async function createCheckoutSession(packageId) {
  if (!_VALID_PACKAGES.has(packageId)) throw new Error("Invalid credit package selected.");
  const session = await ensureSession();
  const res = await _fetchWithTimeout(`${SUPABASE_API_URL}/functions/v1/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey":        SUPABASE_ANON,
    },
    body: JSON.stringify({ packageId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`);
  if (!data.url) throw new Error("No checkout URL returned");
  return data.url;
}

// ---------- Account ----------

async function deleteAccount() {
  const session = await ensureSession();
  const res = await _fetchWithTimeout(`${SUPABASE_API_URL}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey":        SUPABASE_ANON,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
}
