// CvBFF — web app foundation: storage adapter, auth guard, nav bar, toast.

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

// ---------- Nav bar ----------

function renderNav(activePage) {
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
      <button class="app-nav-signout" id="navSignOut">Sign out</button>
    </div>`;
  document.body.insertBefore(nav, document.body.firstChild);
  document.getElementById("navSignOut").addEventListener("click", async () => {
    await signOut().catch(() => {});
    location.href = "/app/auth.html";
  });
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
