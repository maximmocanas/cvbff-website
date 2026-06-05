// CvBFF — My Applications page logic (web version).

let _allApps    = [];
let _activeFilter = "all";
let _activeSort   = "newest";

const AVATAR_COLORS = [
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#d1fae5", fg: "#065f46" },
  { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#fee2e2", fg: "#991b1b" },
];

function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30)  return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
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

function fitRingSvg(score, color) {
  const r = 16, cx = 20, cy = 20;
  const circ = 2 * Math.PI * r;
  const offset = score != null ? circ * (1 - score / 100) : circ;
  return `<svg viewBox="0 0 40 40" width="38" height="38" class="app-fit-svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="3.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="3.5"
      stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
  </svg>`;
}

function statusBadge(status) {
  const map = {
    applied:   { label: "Applied",   cls: "badge-applied" },
    interview: { label: "Interview", cls: "badge-interview" },
    offer:     { label: "Offer",     cls: "badge-offer" },
    rejected:  { label: "Rejected",  cls: "badge-rejected" },
  };
  const s = map[status] || map.applied;
  return `<span class="app-status-badge ${s.cls}">${s.label}</span>`;
}

function renderCard(app) {
  const card = document.createElement("div");
  card.className = "app-card";

  const score    = app.fit_score;
  const color    = scoreColor(score);
  const hasCover = !!(app.cover_text);
  const status   = app.status || "applied";
  const company  = app.company || "";
  const initial  = (company || app.job_title || "?")[0].toUpperCase();
  const av       = avatarColor(company || app.job_title || "");
  const location = app.location || "";

  card.innerHTML = `
    <div class="app-card-top">
      <div class="app-avatar" style="background:${av.bg};color:${av.fg}">${esc(initial)}</div>
      <div class="app-card-top-right">
        ${statusBadge(status)}
        <button class="app-del" title="Delete">✕</button>
      </div>
    </div>
    <div class="app-title">${esc(app.job_title || "Untitled role")}</div>
    <div class="app-meta">${esc(company)}${location ? ` · ${esc(location)}` : ""}</div>
    <hr class="app-divider">
    <div class="app-fit-row">
      <div class="app-fit-left">
        ${fitRingSvg(score, color)}
        <div>
          <div class="app-fit-pct" style="color:${color}">${score != null ? score + "%" : "—"}</div>
          <div class="app-fit-label">Fit score</div>
        </div>
      </div>
      <div class="app-time">${timeAgo(app.created_at)}</div>
    </div>
    <div class="app-actions">
      <button class="btn btn-accent app-open-cv">Open CV</button>
      <button class="btn app-open-cover"${hasCover ? "" : " disabled"}>Cover letter</button>
    </div>
  `;

  card.querySelector(".app-open-cv").addEventListener("click", () => openApp(app, false));
  card.querySelector(".app-open-cover").addEventListener("click", () => { if (hasCover) openApp(app, true); });
  card.querySelector(".app-del").addEventListener("click", () => deleteApp(app.id, card));

  return card;
}

function renderStats(apps) {
  const statsEl = document.getElementById("appsStats");
  if (!statsEl) return;

  const total      = apps.length;
  const interviews = apps.filter(a => (a.status || "applied") === "interview").length;
  const offers     = apps.filter(a => (a.status || "applied") === "offer").length;
  const scores     = apps.map(a => a.fit_score).filter(s => s != null);
  const avgScore   = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const oneWeekAgo = Date.now() - 7 * 86400000;
  const thisWeek   = apps.filter(a => new Date(a.created_at).getTime() > oneWeekAgo).length;

  document.getElementById("statTotal").textContent = total;
  const totalSub = document.getElementById("statTotalSub");
  totalSub.innerHTML = thisWeek > 0
    ? `<span class="stat-week">↑ ${thisWeek} this week</span>`
    : "";

  document.getElementById("statInterviews").textContent = interviews;
  document.getElementById("statInterviewsSub").textContent =
    total > 0 ? `${Math.round(interviews / total * 100)}% conversion` : "";

  document.getElementById("statOffers").textContent = offers;
  const offerApp = apps.find(a => (a.status || "") === "offer");
  document.getElementById("statOffersSub").textContent =
    offerApp ? (offerApp.job_title || "Senior role") : (offers > 0 ? "This month" : "");

  const avgEl = document.getElementById("statAvgScore");
  avgEl.textContent = avgScore != null ? avgScore + "%" : "—";

  statsEl.style.display = "";
}

async function openApp(app, startWithCover = false) {
  await store.set({ savedApplication: { ...app, startWithCover } });
  location.href = "/app/result.html";
}

async function deleteApp(id, card) {
  card.style.opacity = "0.4";
  card.style.pointerEvents = "none";
  try {
    await deleteApplication(id);
    _allApps = _allApps.filter(a => a.id !== id);
    card.remove();
    if (!document.getElementById("appsList").children.length) _applyFilterSort();
    if (!_allApps.length) document.getElementById("appsToolbar").style.display = "none";
    renderStats(_allApps);
  } catch (err) {
    card.style.opacity = "";
    card.style.pointerEvents = "";
    showToast("Couldn't delete: " + err.message, true);
  }
}

function _applyFilterSort() {
  const listEl  = document.getElementById("appsList");
  const emptyEl = document.getElementById("appsEmpty");
  if (!listEl) return;

  let apps = _allApps.filter(a =>
    _activeFilter === "all" || (a.status || "applied") === _activeFilter
  );

  if (_activeSort === "score") {
    apps = [...apps].sort((a, b) => (b.fit_score ?? -1) - (a.fit_score ?? -1));
  }

  listEl.innerHTML = "";
  if (!apps.length) {
    listEl.style.display = "none";
    emptyEl.style.display = "";
    emptyEl.querySelector("p").innerHTML =
      _activeFilter === "all"
        ? "No saved applications yet.<br>Generate a CV and click <strong>Save to my applications</strong>."
        : `No applications with status "${_activeFilter}".`;
  } else {
    listEl.style.display = "";
    emptyEl.style.display = "none";
    apps.forEach(app => listEl.appendChild(renderCard(app)));
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

    renderStats(_allApps);
    toolbarEl.style.display = "";
    _applyFilterSort();

    toolbarEl.querySelectorAll(".filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        _activeFilter = pill.dataset.filter;
        toolbarEl.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("filter-active"));
        pill.classList.add("filter-active");
        _applyFilterSort();
      });
    });

    document.getElementById("appsSortSelect").addEventListener("change", e => {
      _activeSort = e.target.value;
      _applyFilterSort();
    });

  } catch (err) {
    statusEl.querySelector(".spinner").style.display = "none";
    statusTextEl.textContent = "Couldn't load applications: " + err.message;
  }
})();
