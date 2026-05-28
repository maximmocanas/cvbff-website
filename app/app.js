// CvBFF — web app foundation: storage adapter, auth guard, nav bar, toast, shop.

// ---------- localStorage adapter (mirrors chrome.storage.local async API) ----------

const store = {
  get(keys) {
    return new Promise(resolve => {
      if (typeof keys === "string") keys = [keys];
      const out = {};
      (Array.isArray(keys) ? keys : Object.keys(keys)).forEach(k => {
        try {
          const raw = localStorage.getItem("cvbff_" + k);
          if (raw !== null) out[k] = JSON.parse(raw);
        } catch { /* corrupted entry — skip */ }
      });
      resolve(out);
    });
  },
  set(obj) {
    return new Promise(resolve => {
      Object.entries(obj).forEach(([k, v]) => {
        try { localStorage.setItem("cvbff_" + k, JSON.stringify(v)); } catch { /* quota */ }
      });
      resolve();
    });
  },
  remove(keys) {
    return new Promise(resolve => {
      (Array.isArray(keys) ? keys : [keys]).forEach(k => localStorage.removeItem("cvbff_" + k));
      resolve();
    });
  },
  clear() {
    return new Promise(resolve => {
      Object.keys(localStorage)
        .filter(k => k.startsWith("cvbff_"))
        .forEach(k => localStorage.removeItem(k));
      resolve();
    });
  },
};

// ---------- Auth guard ----------

async function authGuard() {
  const user = await getUser();
  if (!user?.email) {
    location.href = "/app/auth.html";
    return null;
  }
  try {
    await ensureSession();
  } catch {
    await store.remove("supabaseSession");
    location.href = "/app/auth.html";
    return null;
  }
  return user;
}

// ---------- Shop modal ----------
// Installed once per page. Works on any page — nav pages and result page alike.

function _installShopModal() {
  if (document.getElementById("_navShopModal")) return;
  const el = document.createElement("div");
  el.id = "_navShopModal";
  el.className = "nav-shop-modal";
  el.style.display = "none";
  el.innerHTML = `
    <div class="nav-shop-backdrop" id="_navShopBackdrop"></div>
    <div class="nav-shop-card">
      <div class="nav-shop-hdr">
        <span class="nav-shop-title">Buy credits</span>
        <button class="btn" id="_navShopClose">✕ Close</button>
      </div>
      <p class="shop-title">CHOOSE A PACK</p>
      <div class="pack-list">
        <button class="pack-card" data-package="pack_10">
          <span class="pack-credits">10 credits</span>
          <span class="pack-price">$1.99</span>
          <span class="pack-note">Try it out — 5 full applications</span>
        </button>
        <button class="pack-card" data-package="pack_30">
          <span class="pack-credits">30 credits</span>
          <span class="pack-price">$4.99</span>
          <span class="pack-note">15 full applications</span>
        </button>
        <button class="pack-card pack-card-popular" data-package="pack_65">
          <span class="pack-badge">Most popular</span>
          <span class="pack-credits">65 credits</span>
          <span class="pack-price">$9.99</span>
          <span class="pack-note">32 full applications</span>
        </button>
        <button class="pack-card" data-package="pack_100">
          <span class="pack-credits">100 credits</span>
          <span class="pack-price">$14.99</span>
          <span class="pack-note">Best value — 50 full applications</span>
        </button>
      </div>
      <p class="auth-error" id="_navShopError" style="display:none; margin-top:12px;"></p>
    </div>`;
  document.body.appendChild(el);

  const close = () => { el.style.display = "none"; };
  document.getElementById("_navShopClose").addEventListener("click", close);
  document.getElementById("_navShopBackdrop").addEventListener("click", close);

  el.querySelectorAll(".pack-card").forEach(card => {
    card.addEventListener("click", async () => {
      const packageId = card.dataset.package;
      const errEl    = document.getElementById("_navShopError");
      const priceEl  = card.querySelector(".pack-price");
      errEl.style.display = "none";
      el.querySelectorAll(".pack-card").forEach(c => { c.disabled = true; });
      const orig = priceEl.textContent;
      priceEl.textContent = "Opening…";
      try {
        // Save current URL so payment-success.html can redirect back here.
        localStorage.setItem("cvbff_buyReturnUrl", location.href);
        const url = await createCheckoutSession(packageId);
        location.href = url; // same-tab — Stripe redirects back after payment
      } catch (e) {
        errEl.textContent = e.message || "Could not start checkout — try again.";
        errEl.style.display = "";
        priceEl.textContent = orig;
        el.querySelectorAll(".pack-card").forEach(c => { c.disabled = false; });
      }
    });
  });
}

function openShopModal() {
  _installShopModal();
  const errEl = document.getElementById("_navShopError");
  if (errEl) errEl.style.display = "none";
  document.getElementById("_navShopModal").style.display = "";
}

// ---------- Nav bar ----------

function renderNav(activePage) {
  _installShopModal();
  const nav = document.createElement("nav");
  nav.className = "app-nav";
  nav.innerHTML = `
    <div class="app-nav-inner">
      <a class="app-nav-brand" href="/app/applications.html">CvBFF</a>
      <div class="app-nav-links">
        <a href="/app/applications.html" class="app-nav-link${activePage === "applications" ? " app-nav-active" : ""}">Applications</a>
        <a href="/app/generate.html"     class="app-nav-link${activePage === "generate"     ? " app-nav-active" : ""}">Generate</a>
        <a href="/app/settings.html"     class="app-nav-link${activePage === "settings"     ? " app-nav-active" : ""}">Settings</a>
      </div>
      <div class="app-nav-right">
        <span class="nav-credit-pill" id="navCreditPill">
          <span id="navCreditCount">…</span>
          <button class="btn-refresh-credits nav-refresh-btn" id="navRefreshCredits" title="Refresh balance">↻</button>
        </span>
        <button class="btn-buy-credits nav-buy-btn" id="navBuyCredits">Buy credits</button>
        <button class="app-nav-signout" id="navSignOut">Sign out</button>
      </div>
    </div>`;
  document.body.insertBefore(nav, document.body.firstChild);

  document.getElementById("navSignOut").addEventListener("click", async () => {
    await signOut().catch(() => {});
    location.href = "/app/auth.html";
  });
  document.getElementById("navBuyCredits").addEventListener("click", openShopModal);
  document.getElementById("navRefreshCredits").addEventListener("click", async () => {
    const btn = document.getElementById("navRefreshCredits");
    btn.disabled = true;
    await _refreshNavCredits();
    btn.disabled = false;
  });

  // Load credits asynchronously — non-blocking.
  _refreshNavCredits();
}

async function _refreshNavCredits() {
  try {
    const c = await getCredits();
    const el = document.getElementById("navCreditCount");
    if (el) {
      el.textContent = `${c} credit${c !== 1 ? "s" : ""}`;
      el.style.color = c === 0 ? "var(--danger)" : c <= 2 ? "#b45309" : "";
    }
  } catch { /* non-critical */ }
}

// ---------- Toast ----------

function showToast(msg, isError = false) {
  let el = document.getElementById("_toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "_toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "toast" + (isError ? " toast-error" : "");
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("toast-visible"), 3200);
}
