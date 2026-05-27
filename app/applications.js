// CvBFF — My Applications page logic (web version).

let _allApps    = [];
let _activeFilter = "all";
let _activeSort   = "newest";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function scoreColor(score) {
  if (score == null) return "var(--muted)";
  if (score >= 70) return "var(--accent)";
  if (score >= 45) return "#b07d2e";
  return "var(--danger)";
}

function esc(s) {
  return (s == null ? "" : String(s))
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderCard(app) {
  const card = document.createElement("div");
  card.className = "app-card";

  const score    = app.fit_score != null ? app.fit_score + "%" : "—";
  const color    = scoreColor(app.fit_score);
  const hasCover = !!(app.cover_text);
  const status   = app.status || "applied";

  card.innerHTML = `
    <div class="app-card-head">
      <span class="app-score" style="color:${color}">${esc(score)}</span>
      <button class="app-del btn-del" title="Delete application">✕</button>
    </div>
    <div class="app-title">${esc(app.job_title || "Untitled role")}</div>
    <div class="app-meta">
      ${app.company ? `<span class="app-company">${esc(app.company)}</span>` : ""}
      ${app.job_url ? `<button class="app-posting-link">View posting ↗</button>` : ""}
    </div>
    <div class="app-date">${formatDate(app.created_at)}</div>
    <div class="app-docs">
      <span class="app-doc app-doc-yes">✓ CV</span>
      ${hasCover
        ? `<span class="app-doc app-doc-yes">✓ Cover letter</span>`
        : `<span class="app-doc app-doc-no">✗ Cover letter</span>`}
    </div>
    <div class="app-status-row">
      <div class="status-pills">
        <button class="status-pill pill-applied${status === "applied"   ? " pill-active" : ""}" data-status="applied">Applied</button>
        <button class="status-pill pill-interview${status === "interview" ? " pill-active" : ""}" data-status="interview">Interview</button>
        <button class="status-pill pill-offer${status === "offer"     ? " pill-active" : ""}" data-status="offer">Offer</button>
        <button class="status-pill pill-rejected${status === "rejected"  ? " pill-active" : ""}" data-status="rejected">Rejected</button>
      </div>
    </div>
    <div class="app-actions">
      <button class="btn btn-accent app-open">Open</button>
    </div>
  `;

  card.querySelector(".app-open").addEventListener("click", () => openApp(app));
  card.querySelector(".app-del").addEventListener("click", () => deleteApp(app.id, card));
  if (app.job_url) {
    card.querySelector(".app-posting-link").addEventListener("click", () => window.open(app.job_url, "_blank"));
  }

  // Status pills — persist to Supabase and update the active pill.
  let currentStatus = status;
  const pillContainer = card.querySelector(".status-pills");
  pillContainer.addEventListener("click", async (e) => {
    const pill = e.target.closest(".status-pill");
    if (!pill) return;
    const next = pill.dataset.status;
    if (next === currentStatus) return;
    const prev = currentStatus;
    currentStatus = next;
    pillContainer.querySelectorAll(".status-pill").forEach(p => p.classList.remove("pill-active"));
    pill.classList.add("pill-active");
    try {
      await updateApplication(app.id, { status: next });
    } catch {
      currentStatus = prev;
      pillContainer.querySelectorAll(".status-pill").forEach(p => p.classList.remove("pill-active"));
      pillContainer.querySelector(`[data-status="${prev}"]`).classList.add("pill-active");
      showToast("Couldn't update status — please try again.", true);
    }
  });

  return card;
}

async function openApp(app) {
  await store.set({ savedApplication: app });
  location.href = "/app/result.html";
}

async function deleteApp(id, card) {
  card.style.opacity = "0.4";
  card.style.pointerEvents = "none";
  try {
    await deleteApplication(id);
    _allApps = _allApps.filter(a => a.id !== id);
    card.remove();
    if (!document.getElementById("appsGrid").children.length) _applyFilterSort();
    if (!_allApps.length) document.getElementById("appsToolbar").style.display = "none";
  } catch (err) {
    card.style.opacity = "";
    card.style.pointerEvents = "";
    showToast("Couldn't delete: " + err.message, true);
  }
}

function _applyFilterSort() {
  const gridEl  = document.getElementById("appsGrid");
  const emptyEl = document.getElementById("appsEmpty");
  if (!gridEl) return;

  let apps = _allApps.filter(a =>
    _activeFilter === "all" || (a.status || "applied") === _activeFilter
  );

  if (_activeSort === "score") {
    apps = [...apps].sort((a, b) => (b.fit_score ?? -1) - (a.fit_score ?? -1));
  }

  gridEl.innerHTML = "";
  if (!apps.length) {
    gridEl.style.display = "none";
    emptyEl.style.display = "";
    emptyEl.querySelector("p").innerHTML =
      _activeFilter === "all"
        ? "No saved applications yet.<br>Generate a CV and click <strong>Save to my applications</strong>."
        : `No applications with status "${_activeFilter}".`;
  } else {
    gridEl.style.display = "";
    emptyEl.style.display = "none";
    apps.forEach(app => gridEl.appendChild(renderCard(app)));
  }
}

(async function init() {
  const user = await authGuard();
  if (!user) return;
  renderNav("applications");

  const statusEl     = document.getElementById("appsStatus");
  const statusTextEl = document.getElementById("appsStatusText");
  const emptyEl      = document.getElementById("appsEmpty");
  const toolbarEl    = document.getElementById("appsToolbar");

  try {
    await ensureSession();
    _allApps = await getApplications();
    statusEl.style.display = "none";

    if (!_allApps.length) {
      emptyEl.style.display = "";
      return;
    }

    toolbarEl.style.display = "";
    _applyFilterSort();

    // Filter pill clicks.
    toolbarEl.querySelectorAll(".filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        _activeFilter = pill.dataset.filter;
        toolbarEl.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("filter-active"));
        pill.classList.add("filter-active");
        _applyFilterSort();
      });
    });

    // Sort select.
    document.getElementById("appsSortSelect").addEventListener("change", e => {
      _activeSort = e.target.value;
      _applyFilterSort();
    });

  } catch (err) {
    statusEl.querySelector(".spinner").style.display = "none";
    statusTextEl.textContent = "Couldn't load applications: " + err.message;
  }
})();
