// CvBFF — result page orchestration (web version).

// Scale a document page to fill the mobile viewport.
// Uses a wrapper element (#cvScaleWrap / #coverScaleWrap) so the page sits at
// position (0,0) and scales from top-left — no flex-centering ambiguity.
function _scalePage(pageId, wrapId) {
  const page = document.getElementById(pageId);
  const wrap = document.getElementById(wrapId);
  if (!page || !wrap) return;
  if (window.innerWidth >= 860) {
    page.style.transform  = "";
    page.style.position   = "";
    page.style.minHeight  = "";
    wrap.style.height     = "";
    return;
  }
  const scale = wrap.offsetWidth / 794;
  // Collapse the A4 min-height so the card shrinks to actual content on mobile.
  // Must be set HERE (after fitToOnePage) not in CSS (before fitToOnePage).
  page.style.minHeight       = "0";
  const h                    = page.offsetHeight || 1123;
  page.style.position        = "absolute";
  page.style.transformOrigin = "top left";
  page.style.transform       = `scale(${scale})`;
  wrap.style.height = `${Math.round(h * scale)}px`;
}
function scaleCvMobile()    { _scalePage("page",      "cvScaleWrap");    }
function scaleCoverMobile() { _scalePage("coverPage", "coverScaleWrap"); }
window.addEventListener("resize", () => { scaleCvMobile(); scaleCoverMobile(); });

function showToast(msg, isError = false) {
  let el = document.getElementById("_toast");
  if (!el) { el = document.createElement("div"); el.id = "_toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = "toast" + (isError ? " toast-error" : "");
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("toast-visible"), 3200);
}

function setStatus(text, isError) {
  stopMilestones();
  const s = document.getElementById("status");
  const t = document.getElementById("statusText");
  s.style.display = "";
  s.classList.toggle("error", !!isError);
  const header = document.getElementById("cvGenHeader");
  if (header) header.style.display = "none";
  const ms = document.getElementById("cvMilestones");
  if (ms) ms.style.display = "none";
  t.textContent = text;
  t.style.display = text ? "" : "none";
}

// ---------- Prompt ----------

function buildPrompt(profile, jobText, pageCount = 1) {
  const roles = (profile.roles || []).map((r, i) => {
    const startStr = [r.startMonth, r.start].filter(Boolean).join(" ");
    const endStr   = [r.endMonth,   r.end  ].filter(Boolean).join(" ");
    const dates    = [startStr, endStr].filter(Boolean).join("–");
    const typeTag  = r.jobType ? ` [${r.jobType}]` : "";
    return `ROLE ${i} (ref=${i}): ${r.title || "—"} at ${r.company || "—"} (${dates})${typeTag}\n` +
           `What they did: ${r.background || "(no detail provided)"}`;
  }).join("\n\n");

  const skillBank = (profile.skills || []).join(", ") || "(none provided)";

  const certsList = (profile.certifications || []).filter(c => c.name)
    .map(c => `${c.name}${c.issuer ? ` (${c.issuer}${c.year ? ", " + c.year : ""})` : c.year ? ` (${c.year})` : ""}`).join("; ");
  const awardsList = (profile.awards || []).filter(a => a.title)
    .map(a => `${a.title}${a.org ? ` (${a.org}${a.year ? ", " + a.year : ""})` : a.year ? ` (${a.year})` : ""}`).join("; ");

  const modeBlock = `
MODE: MODELING (aggressive evidence-hunting).

CRITICAL DISTINCTION — two different sources of evidence, treated differently:

A) SKILLS BANK items = skills the candidate CONFIRMS they genuinely have. Treat these as facts.
   - If a skills bank item is relevant to the posting, your job is to find WHERE in their roles it was most plausibly applied and write a bullet that brings it to life.
   - Reason from the role context: "This person worked at a tech startup doing internal tooling — Chrome Extension development fits here." Then write the bullet grounded in that role's actual context (the team, the problem space, the type of output).
   - Skills bank items must NEVER appear in the gaps array. They are confirmed skills — not missing ones.

B) JOB POSTING requirements with NO basis in background or skills bank → go in gaps.

PROCESS:
- Step 1: For each skills bank item relevant to the posting, identify the role it most plausibly fits and draft a bullet that makes it concrete within that role's real context.
- Step 2: Go requirement by requirement through the posting. For EACH, search the background for genuine evidence — including loose, transferable, or implied matches. Examples: posting wants "SQL" and background says "pulled and analysed data in dashboards" → surface that as evidence; posting wants "works under pressure" and background says "managed competing deadlines across three teams" → build a bullet from that real fact.
- TOOL INFERENCE (for posting requirements not in skills bank): When the posting names a specific tool (e.g. Athena, dbt, Tableau) and the background shows adjacent or equivalent experience (e.g. SQL on AWS, data transformation pipelines, BI dashboards), infer the candidate plausibly used or encountered it and name it in a relevant bullet grounded in their real context. Do not name a tool with no plausible basis.
- SKILLS LIST: include a skill only if it either (a) appears in the skills bank and is relevant to the posting, or (b) you have written it into a bullet via tool inference. Every skill in the list must be backed by at least one bullet.
- GAPS: only posting requirements with genuinely no basis in the background AND not in the skills bank. Never put skills bank items here.`;

  const pageRules = pageCount === 3 ? {
    label:       "THREE PAGES",
    desc:        "Content should richly fill three A4 pages.",
    budget:      "Budget ~38–48 bullets total across summary and all roles.",
    allocation:  "Give every role comprehensive coverage — 6–10 bullets each. Surface detailed achievements, projects, and metrics for every role. Never drop a role.",
    summary:     "Summary 100–130 words.",
    skills:      "~18–24 skills, most posting-relevant first.",
  } : pageCount === 2 ? {
    label:       "TWO PAGES",
    desc:        "Content should richly fill two A4 pages.",
    budget:      "Budget ~24–32 bullets total across summary and all roles.",
    allocation:  "Give highly relevant roles up to 8 bullets; older or less-relevant roles 3–4. Never drop a role entirely. Recency breaks ties.",
    summary:     "Summary 75–100 words.",
    skills:      "~14–18 skills, most posting-relevant first.",
  } : {
    label:       "ONE PAGE",
    desc:        "Must fit one A4 page.",
    budget:      "Budget ~14–16 bullets total across summary and all roles.",
    allocation:  "Score each role's relevance to THIS posting; give relevant roles more bullets (up to ~6), compress weak/older roles to 1–2. Never drop a role entirely. Recency breaks ties.",
    summary:     "Summary 50–75 words.",
    skills:      "~10–14 skills, most posting-relevant first.",
  };

  return `You are an expert CV writer. Produce a ${pageRules.label} CV tailored to the job posting below, grounded in the candidate's real experience.

JOB POSTING:
"""
${jobText.slice(0, 6000)}
"""

CANDIDATE SKILLS BANK:
${skillBank}

CANDIDATE ROLES (newest first):
${roles}
${certsList  ? `\nCANDIDATE CERTIFICATIONS:\n${certsList}` : ""}
${awardsList ? `\nCANDIDATE AWARDS & ACHIEVEMENTS:\n${awardsList}` : ""}
${modeBlock}

TONE MATCHING: Read the posting's voice and mirror it. If it's a startup/scale-up that emphasises drive, ownership, and soft skills, write confident, energetic, direct prose. If it's corporate/formal, use measured, professional, polished language. Match register, not just keywords — the CV should feel like it belongs to that company's world.

UNIVERSAL RULES:
1. HONESTY: Never claim a skill or achievement with no basis in the background. Reframing, emphasising, and surfacing transferable experience is encouraged; fabrication is not.
2. KEYWORD MATCH: Mirror the posting's terminology wherever it truthfully applies, for ATS alignment.
3. ${pageRules.label}: ${pageRules.desc} ${pageRules.budget}
4. RELEVANCE-WEIGHTED ALLOCATION: ${pageRules.allocation}
5. REPRESENTATIVE-FIRST FOR COMPRESSED ROLES: A role compressed to 1–2 bullets must still capture its DEFINING responsibilities.
6. ORDER: Roles newest-first. Each role object MUST include its original "ref" index.
7. LENGTH: ${pageRules.summary} Each bullet 12–22 words, starting with a strong verb.
8. SKILLS: ${pageRules.skills}
9. SPECIFICITY: every bullet must pull a real, concrete detail from the background.
10. SKILLS-BULLETS ALIGNMENT: every skill or tool in the skills list must be evidenced by at least one bullet (or the summary).

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "jobTitle": "the target role title to show under the name",
  "company": "the hiring company name extracted from the posting",
  "summary": "the summary paragraph",
  "summaryBullets": ["3-5 short 'what I work on' bullets"],
  "skills": ["selected", "skills"],
  "roles": [{"ref": 0, "bullets": ["..."]}, {"ref": 1, "bullets": ["..."]}],
  "gaps": [{"skill": "tool or skill name only — 1–3 words", "reason": "one-line explanation why it could not be substantiated"}],
  "fitScore": 73,
  "fitReason": ["bullet 1", "bullet 2", "bullet 3"],
  "interviewPrep": {
    "brushUp": ["topic or concept to review"],
    "tools": ["tool to get familiar with"],
    "questions": ["Likely interview question?"]
  }
}`;
}

// ---------- Credit pill ----------

function updateCreditPill(credits) {
  const pill    = document.getElementById("creditPill");
  const countEl = document.getElementById("creditPillCount");
  if (!pill || !countEl) return;
  if (typeof credits !== "number") { pill.style.display = "none"; return; }
  countEl.textContent = `${credits} credit${credits !== 1 ? "s" : ""}`;
  pill.style.display = "";
  // Show the Buy credits button once we know the user is authenticated.
  const buyBtn = document.getElementById("resultBuyCredits");
  if (buyBtn) buyBtn.style.display = "";
}

async function fetchAndShowCreditPill() {
  try {
    const credits = await getCredits();
    updateCreditPill(credits);
  } catch { /* non-critical */ }
}

// ---------- API ----------

async function workerFetch(body, path = "/") {
  const session = await ensureSession();
  return fetch(API_URL + path, {
    method: "POST",
    headers: {
      "content-type":  "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
}

async function loadProfileAndJob() {
  const s = await store.get(["profile", "pendingJob"]);
  if (!s.profile?.roles?.length) throw new Error("No roles saved yet. Add your experience in Settings first.");
  if (!s.pendingJob?.text)       throw new Error("No job posting found. Go back to Generate and paste one.");
  return { profile: s.profile, job: s.pendingJob };
}

// ---------- Milestones ----------

const CV_MILESTONES = [
  "Looking at your CV and experience…",
  "Researching the job posting…",
  "Identifying the strongest matches…",
  "Crafting tailored bullet points…",
  "Polishing the final draft…",
];
const COVER_MILESTONES = [
  "Looking at your CV and experience…",
  "Researching the posting and company…",
  "Planning the letter structure…",
  "Drafting your cover letter…",
  "Refining the tone and content…",
];

let _milestoneTimer = null;

function renderStepper(milestones, containerId, activeIndex) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="ms-stepper">` +
    milestones.map((label, i) => {
      const cls = `ms-step${i < activeIndex ? " ms-done" : ""}${i === activeIndex ? " ms-active" : ""}`;
      return `<div class="${cls}"><div class="ms-dot"></div><div class="ms-content"><span class="ms-label">${label}</span></div></div>`;
    }).join("") +
  `</div>`;
}

function startMilestones(milestones, containerId) {
  stopMilestones();
  let i = 0;
  renderStepper(milestones, containerId, 0);
  document.getElementById(containerId).style.display = "";
  _milestoneTimer = setInterval(() => {
    i = Math.min(i + 1, milestones.length - 1);
    renderStepper(milestones, containerId, i);
    if (i === milestones.length - 1) stopMilestones();
  }, 9000);
}

function stopMilestones() {
  if (_milestoneTimer) { clearInterval(_milestoneTimer); _milestoneTimer = null; }
}

// ---------- Pre-gen prompts ----------

function showCvPrompt() {
  document.getElementById("stage").style.display = "none";
  document.getElementById("coverStage").style.display = "none";
  document.getElementById("coverStatus").style.display = "none";
  document.getElementById("cvControls").style.display = "contents";
  document.getElementById("coverControls").style.display = "none";
  document.getElementById("tabCv")?.classList.add("tab-active");
  document.getElementById("tabCover")?.classList.remove("tab-active");
  const s = document.getElementById("status");
  s.style.display = "";
  s.classList.remove("error");
  document.getElementById("cvGenHeader").style.display = "none";
  document.getElementById("cvMilestones").style.display = "none";
  const t = document.getElementById("statusText");
  t.textContent = "Pick a template and colour, then generate.";
  t.style.display = "";
  const cvPanel = document.getElementById("cvPreGenPanel");
  if (cvPanel) cvPanel.style.display = "";
  const coverPanel = document.getElementById("coverPreGenPanel");
  if (coverPanel) coverPanel.style.display = "none";
  const trigger = document.getElementById("genTrigger");
  if (trigger) {
    trigger.textContent = "Generate CV";
    trigger.style.display = "";
    trigger.onclick = () => { trigger.style.display = "none"; generate(); };
  }
  updateTplSwatches("cvTplSwatchesInline", currentCvTemplate);
  renderThemeSwatchesInline("cv", _currentThemeId);
  renderMiniPreview("cv");
}

function showCoverPrompt() {
  document.getElementById("cvControls").style.display = "none";
  document.getElementById("coverControls").style.display = "contents";
  document.getElementById("stage").style.display = "none";
  document.getElementById("status").style.display = "none";
  document.getElementById("coverStage").style.display = "none";
  document.getElementById("tabCv")?.classList.remove("tab-active");
  document.getElementById("tabCover")?.classList.add("tab-active");
  const s = document.getElementById("coverStatus");
  s.style.display = "";
  s.classList.remove("error");
  document.getElementById("coverGenHeader").style.display = "none";
  document.getElementById("coverMilestones").style.display = "none";
  const t = document.getElementById("coverStatusText");
  t.textContent = "Pick a template and colour, then generate.";
  t.style.display = "";
  const cvPanel = document.getElementById("cvPreGenPanel");
  if (cvPanel) cvPanel.style.display = "none";
  const coverPanel = document.getElementById("coverPreGenPanel");
  if (coverPanel) coverPanel.style.display = "";
  const trigger = document.getElementById("coverGenTrigger");
  if (trigger) {
    trigger.style.display = "";
    trigger.onclick = () => { trigger.style.display = "none"; generateCover(); };
  }
  updateTplSwatches("coverTplSwatchesInline", currentCoverTemplate);
  renderThemeSwatchesInline("cover", _currentThemeId);
  renderMiniPreview("cover");
}

// ---------- Flow ----------

async function generate() {
  const savedIdToRestore = (regenMode === "replace") ? savedAppId : null;
  resetSaveButtons();
  if (savedIdToRestore) savedAppId = savedIdToRestore;

  isUnlocked   = false;
  tailored     = null;
  generationId = null;
  coverReady   = false;

  ["cvEdit", "regen"].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = true; });

  document.getElementById("tabCover").disabled = true;
  document.getElementById("download").disabled = true;
  document.getElementById("coverStage").style.display = "none";
  document.getElementById("coverStatus").style.display = "none";
  document.getElementById("stage").style.display = "none";

  const s = document.getElementById("status");
  s.style.display = ""; s.classList.remove("error");
  document.getElementById("cvGenHeader").style.display = "";
  document.getElementById("statusText").style.display = "none";
  document.getElementById("genTrigger").style.display = "none";
  const cvPanelGen = document.getElementById("cvPreGenPanel");
  if (cvPanelGen) cvPanelGen.style.display = "none";
  startMilestones(CV_MILESTONES, "cvMilestones");

  let profile, job;
  try {
    ({ profile, job } = await loadProfileAndJob());
  } catch (err) {
    stopMilestones();
    regenMode = null;
    document.getElementById("regen").disabled = false;
    return setStatus(err.message, true);
  }

  try {
    const res = await workerFetch({
      messages: [{ role: "user", content: buildPrompt(profile, job.text, cvPageCount) }],
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("Rate limited — wait a moment and try again.");
      throw new Error(e?.error?.message || `API error ${res.status}`);
    }
    const { generation_id, preview } = await res.json();
    generationId = generation_id;

    document.getElementById("status").style.display = "none";
    showView("cv");

    renderLockedCV(profile, preview);
    document.getElementById("tabCvIcon").textContent = "🔒";
    document.getElementById("tabCvIcon").className = "tab-icon tab-cross";

    renderGaps(preview.gaps);
    if (typeof preview.fitScore === "number") renderFitScore(preview.fitScore, preview.fitReason);
    if (preview.interviewPrep) renderInterviewPrep(preview.interviewPrep);

    cvReady = true;
    document.getElementById("regen").disabled = false;
    document.getElementById("tabBar").style.display = "";
    stopMilestones();
  } catch (err) {
    stopMilestones();
    setStatus(err.message, true);
    document.getElementById("regen").disabled = false;
  } finally {
    regenMode = null;
    document.getElementById("tabCover").disabled = false;
  }
}

function renderLockedCV(profile, preview) {
  const mockTailored = {
    jobTitle:       preview.jobTitle,
    company:        preview.company,
    summary:        preview.summaryPreview,
    summaryBullets: [],
    skills:         preview.skills || [],
    roles:          preview.previewRoles || [],
    gaps:           [],
  };
  renderCV(profile, mockTailored, currentCvTemplate);
  scaleCvMobile();
  addCVLockOverlay();
}

function addCVLockOverlay() {
  const page = document.getElementById("page");
  if (!page || document.getElementById("lockOverlay")) return;
  const isMobile = window.innerWidth < 860;
  const overlay = document.createElement("div");
  overlay.id = "lockOverlay";
  overlay.innerHTML = `
    <div class="lock-cta">
      <div class="lock-icon">🔒</div>
      <p class="lock-msg">Your tailored CV is ready</p>
      <p class="lock-sub">Use 1 credit to unlock the full document and enable the PDF download.</p>
      <button class="btn btn-accent" id="unlockBtn">Unlock · 1 credit</button>
      <p class="lock-credits-note" id="lockCreditsNote"></p>
    </div>`;
  if (isMobile) {
    // On mobile the CV is scaled via transform, which makes position:fixed children
    // behave like position:absolute (CSS quirk). Append to body instead so the
    // overlay truly sits outside the scaled element and is full-size and tappable.
    overlay.className = "cv-lock-overlay-mobile";
    document.body.appendChild(overlay);
  } else {
    overlay.className = "cv-lock-overlay";
    page.style.position = "relative";
    page.appendChild(overlay);
  }
  getCredits().then(c => {
    const el = document.getElementById("lockCreditsNote");
    if (el) el.textContent = `You have ${c} credit${c !== 1 ? "s" : ""} remaining.`;
  }).catch(() => {});
  document.getElementById("unlockBtn").addEventListener("click", handleUnlock);
}

function addCoverLockOverlay() {
  const page = document.getElementById("coverPage");
  if (!page || document.getElementById("coverLockOverlay")) return;
  const isMobile = window.innerWidth < 860;
  const overlay = document.createElement("div");
  overlay.id = "coverLockOverlay";
  overlay.innerHTML = `
    <div class="lock-cta">
      <div class="lock-icon">🔒</div>
      <p class="lock-msg">Your cover letter is ready</p>
      <p class="lock-sub">Use 1 credit to unlock the full cover letter and enable the download.</p>
      <button class="btn btn-accent" id="coverUnlockBtn">Unlock · 1 credit</button>
      <p class="lock-credits-note" id="coverLockCreditsNote"></p>
    </div>`;
  if (isMobile) {
    overlay.className = "cv-lock-overlay-mobile";
    document.body.appendChild(overlay);
  } else {
    overlay.className = "cv-lock-overlay";
    page.style.position = "relative";
    page.appendChild(overlay);
  }
  getCredits().then(c => {
    const el = document.getElementById("coverLockCreditsNote");
    if (el) el.textContent = `You have ${c} credit${c !== 1 ? "s" : ""} remaining.`;
  }).catch(() => {});
  document.getElementById("coverUnlockBtn").addEventListener("click", handleCoverUnlock);
}

async function handleCoverUnlock() {
  const btn = document.getElementById("coverUnlockBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Unlocking…"; }

  try {
    if (!coverGenerationId) throw new Error("No cover letter generation found — please regenerate.");

    const res = await workerFetch({ cover_generation_id: coverGenerationId }, "/unlock-cover");
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(
        res.status === 402 ? "Not enough credits. You need at least 1 credit to unlock."
                           : e?.error?.message || "Unlock failed"
      );
    }

    const data = await res.json();
    coverText     = data.cover_text      || "";
    coverJobTitle = data.cover_job_title || coverJobTitle;
    const credits = data.credits;
    isCoverUnlocked = true;

    const { profile } = await store.get("profile");
    document.getElementById("coverLockOverlay")?.remove();
    renderCover(profile, coverText, coverJobTitle, currentCoverTemplate);
    fitCoverToOnePage(); scaleCoverMobile();
    document.getElementById("coverEdit").disabled = false;
    document.getElementById("coverCopy").disabled = false;
    document.getElementById("coverDownload").disabled = false;
    document.getElementById("saveAppCover").disabled = false;
    document.getElementById("tabCoverIcon").textContent = "✓";
    document.getElementById("tabCoverIcon").className = "tab-icon tab-check";
    const styleBarCU = document.getElementById("styleBar");
    if (styleBarCU) styleBarCU.style.display = "";
    const cvTplCU = document.getElementById("cvTplSwatches");
    if (cvTplCU) cvTplCU.style.display = "none";
    const coverTplCU = document.getElementById("coverTplSwatches");
    if (coverTplCU) coverTplCU.style.display = "";

    if (typeof credits === "number") updateCreditPill(credits);

    if (savedAppId) {
      await updateApplication(savedAppId, {
        cover_text:      coverText || null,
        cover_job_title: coverJobTitle || null,
        cover_html:      document.getElementById("coverPage")?.innerHTML || null,
      }).catch(() => {});
      const b = document.getElementById("saveAppCover");
      if (b) { b.textContent = "Saved ✓"; b.classList.add("btn-saved"); }
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Unlock · 1 credit"; }
    showToast(err.message, true);
  }
}

async function handleUnlock() {
  const _ub = document.getElementById("unlockBtn");
  if (_ub) { _ub.disabled = true; _ub.textContent = "Unlocking…"; }

  try {
    if (!generationId) throw new Error("No generation found — please regenerate.");

    const res = await workerFetch({ generation_id: generationId }, "/unlock");
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(
        res.status === 402 ? "Not enough credits. You need at least 1 credit to unlock."
                           : e?.error?.message || "Unlock failed"
      );
    }

    const data = await res.json();
    tailored   = data.tailored;
    const credits = data.credits;
    isUnlocked = true;

    const { profile } = await store.get("profile");

    document.getElementById("lockOverlay")?.remove();
    renderCV(profile, tailored, currentCvTemplate);
    fitCvToPages(tailored, profile, cvPageCount);
    scaleCvMobile();
    renderGaps(tailored.gaps);
    if (typeof tailored.fitScore === "number") renderFitScore(tailored.fitScore, tailored.fitReason);
    if (tailored.interviewPrep) renderInterviewPrep(tailored.interviewPrep);
    document.getElementById("cvEdit").disabled = false;
    document.getElementById("download").disabled = false;
    document.getElementById("saveApp").disabled = false;
    document.getElementById("tabCvIcon").textContent = "✓";
    document.getElementById("tabCvIcon").className = "tab-icon tab-check";

    const styleBar = document.getElementById("styleBar");
    if (styleBar) styleBar.style.display = "";
    const cvTpl = document.getElementById("cvTplSwatches");
    if (cvTpl) cvTpl.style.display = "";
    const coverTpl = document.getElementById("coverTplSwatches");
    if (coverTpl) coverTpl.style.display = "none";

    try {
      const { generateCount = 0 } = await store.get("generateCount");
      await store.set({ generateCount: generateCount + 1 });
    } catch { /* non-critical */ }

    if (typeof credits === "number") updateCreditPill(credits);

    if (savedAppId && isCoverUnlocked) {
      await updateApplication(savedAppId, {
        cv_html: document.getElementById("page")?.innerHTML || null,
      }).catch(() => {});
      const b = document.getElementById("saveApp");
      if (b) { b.textContent = "Saved ✓"; b.classList.add("btn-saved"); }
    }
  } catch (err) {
    const _ub2 = document.getElementById("unlockBtn");
    if (_ub2) { _ub2.disabled = false; _ub2.textContent = "Unlock · 1 credit"; }
    showToast(err.message, true);
  }
}

let cvReady = false;
let coverReady = false;
let cvPageCount = 1;
const activeMode = "modeling";
let tailored = null;
let coverJobTitle = "";
let generationId = null;
let coverGenerationId = null;
let isUnlocked = false;
let isCoverUnlocked = false;
let regenMode = null;

let currentCvTemplate    = "classic";
let currentCoverTemplate = "classic";
let _currentThemeHex     = "#4F6EF7";
let _currentThemeId      = "blue-indigo";

// ---------- Color themes ----------

const COLOR_THEMES = [
  { id: "blue-indigo", label: "Blue",    hex: "#4F6EF7", soft: "#EEF1FE", ink: "#3B57D9" },
  { id: "emerald",     label: "Emerald", hex: "#10b981", soft: "#d1fae5", ink: "#059669" },
  { id: "slate",       label: "Slate",   hex: "#475569", soft: "#f1f5f9", ink: "#334155" },
  { id: "rose",        label: "Rose",    hex: "#f43f5e", soft: "#ffe4e6", ink: "#e11d48" },
  { id: "amber",       label: "Amber",   hex: "#f59e0b", soft: "#fef3c7", ink: "#d97706" },
  { id: "black",       label: "Black",   hex: "#111111", soft: "#f3f4f6", ink: "#000000" },
];

function applyTheme(themeId) {
  const t = COLOR_THEMES.find(x => x.id === themeId) || COLOR_THEMES[0];
  _currentThemeHex = t.hex;
  _currentThemeId  = t.id;
  document.querySelectorAll(".cv-page").forEach(el => {
    el.style.setProperty("--cv-accent", t.hex);
  });
}

async function savePrefs(patch) {
  try {
    const { cvPrefs = {} } = await store.get("cvPrefs");
    await store.set({ cvPrefs: { ...cvPrefs, ...patch } });
  } catch { /* non-critical */ }
}

function updateTplSwatches(containerId, activeValue) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.querySelectorAll(".tpl-swatch").forEach(btn => {
    btn.classList.toggle("tpl-swatch-active", btn.dataset.tpl === activeValue);
  });
}

function renderThemeSwatches(activeThemeId) {
  const container = document.getElementById("themeSwatches");
  if (!container) return;
  container.innerHTML = COLOR_THEMES.map(t =>
    `<button class="theme-swatch ${t.id === activeThemeId ? "swatch-active" : ""}"
      style="background:${t.hex}" data-theme="${t.id}" title="${t.label}" aria-label="${t.label} theme"></button>`
  ).join("");
  container.querySelectorAll(".theme-swatch").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.theme;
      applyTheme(id);
      savePrefs({ themeId: id });
      renderThemeSwatches(id);
    });
  });
}

function renderThemeSwatchesInline(which, activeThemeId) {
  const containerId = which === "cv" ? "cvThemeSwatchesInline" : "coverThemeSwatchesInline";
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = COLOR_THEMES.map(t =>
    `<button class="theme-swatch ${t.id === activeThemeId ? "swatch-active" : ""}"
      style="background:${t.hex}" data-theme="${t.id}" title="${t.label}" aria-label="${t.label} theme"></button>`
  ).join("");
  container.querySelectorAll(".theme-swatch").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.theme;
      applyTheme(id);
      savePrefs({ themeId: id });
      renderThemeSwatches(id);
      renderThemeSwatchesInline(which, id);
      const miniId = which === "cv" ? "cvMiniPage" : "coverMiniPage";
      const miniEl = document.getElementById(miniId);
      if (miniEl) miniEl.style.setProperty("--cv-accent", _currentThemeHex);
    });
  });
}

// ---------- Interview prep panel ----------

function renderInterviewPrep(prep) {
  const panel = document.getElementById("interviewPanel");
  if (!panel || !prep) return;

  function fillSection(sectionId, listId, items) {
    const section = document.getElementById(sectionId);
    const list    = document.getElementById(listId);
    if (!section || !list) return;
    const arr = Array.isArray(items) ? items.filter(Boolean) : [];
    list.innerHTML = arr.map(s => `<li>${escHtml(s)}</li>`).join("");
    section.style.display = arr.length ? "" : "none";
  }

  fillSection("ipBrushSection", "ipBrushUp",  prep.brushUp);
  fillSection("ipToolsSection", "ipTools",     prep.tools);
  fillSection("ipQSection",     "ipQuestions", prep.questions);
  panel.style.display = "";
}

// ---------- Fit score ring ----------

function renderFitScore(score, bullets) {
  const panel    = document.getElementById("fitPanel");
  const arc      = document.getElementById("fitRingArc");
  const lbl      = document.getElementById("fitRingLabel");
  const bulletEl = document.getElementById("fitPanelBullets");
  if (!panel || !arc || !lbl) return;

  const pct   = Math.max(0, Math.min(100, Math.round(score || 0)));
  const circ  = 2 * Math.PI * 33;
  const color = pct >= 70 ? "var(--accent)" : pct >= 45 ? "#b07d2e" : "var(--danger)";

  arc.style.strokeDashoffset = circ * (1 - pct / 100);
  arc.style.stroke = color;
  lbl.textContent = pct + "%";

  if (bulletEl) {
    const items = Array.isArray(bullets) ? bullets : [];
    bulletEl.innerHTML = items.map(b => `<li>${escHtml(b)}</li>`).join("");
  }

  panel.style.display = "";
}

// ---------- Gaps box ----------

function renderGaps(gaps) {
  const box = document.getElementById("gapsBox");
  if (box) { box.style.display = "none"; box.innerHTML = ""; }
}


// ---------- Inline editing ----------

function setupEditToggle(btnId, pageId, onDone) {
  const btn = document.getElementById(btnId);
  const page = document.getElementById(pageId);
  if (!btn || !page) return;
  btn.addEventListener("click", () => {
    const editing = page.getAttribute("contenteditable") === "true";
    if (editing) {
      page.setAttribute("contenteditable", "false");
      btn.textContent = "Edit text";
      btn.classList.remove("btn-accent");
      if (typeof onDone === "function") onDone();
    } else {
      page.setAttribute("contenteditable", "true");
      btn.textContent = "Done editing";
      btn.classList.add("btn-accent");
      page.focus();
    }
  });
}

function showView(which) {
  const cv = which === "cv";
  document.getElementById("cvControls").style.display = cv ? "contents" : "none";
  document.getElementById("coverControls").style.display = cv ? "none" : "contents";
  document.getElementById("stage").style.display = cv ? "" : "none";
  document.getElementById("coverStage").style.display = cv ? "none" : "flex";
  // Re-scale the cover page whenever it becomes visible — measurements are
  // unreliable while display:none, so we always recalculate on tab switch.
  if (!cv) scaleCoverMobile();
  const gaps = document.getElementById("gapsBox");
  if (gaps && !cv) gaps.style.display = "none";
  document.getElementById("tabCv")?.classList.toggle("tab-active", cv);
  document.getElementById("tabCover")?.classList.toggle("tab-active", !cv);
  const styleBar = document.getElementById("styleBar");
  if (styleBar && styleBar.style.display !== "none") {
    const cvTpl    = document.getElementById("cvTplSwatches");
    const coverTpl = document.getElementById("coverTplSwatches");
    if (cvTpl)    cvTpl.style.display    = cv ? "" : "none";
    if (coverTpl) coverTpl.style.display = cv ? "none" : "";
  }
  ["page", "coverPage"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute("contenteditable", "false");
  });
  ["cvEdit", "coverEdit"].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.textContent = "Edit text"; b.classList.remove("btn-accent"); }
  });
}

function printOnly(which) {
  document.body.classList.remove("print-cv", "print-cover");
  document.body.classList.add(which === "cover" ? "print-cover" : "print-cv");
  if (which !== "cover" && cvPageCount > 1) {
    document.body.dataset.printPages = String(cvPageCount);
  } else {
    delete document.body.dataset.printPages;
  }
  window.print();
  delete document.body.dataset.printPages;
}

document.getElementById("download").addEventListener("click", () => printOnly("cv"));
document.getElementById("regen").addEventListener("click", handleRegen);

// ---------- Regen flow ----------

async function handleRegen() {
  const modal   = document.getElementById("regenModal");
  const msg     = document.getElementById("regenModalMsg");
  const actions = document.getElementById("regenModalActions");

  if (savedAppId) {
    msg.innerHTML = "This uses <strong>1 credit</strong>. You have a saved copy of this application.";
    actions.innerHTML = `
      <button class="btn btn-accent" id="_mrReplace">Replace saved · 1 credit</button>
      <button class="btn"            id="_mrNew">Keep saved · 1 credit</button>
      <button class="btn"            id="_mrCancel">Cancel</button>`;
    document.getElementById("_mrReplace").onclick = () => { closeRegenModal(); regenWithCredit("replace"); };
    document.getElementById("_mrNew").onclick     = () => { closeRegenModal(); regenWithCredit("new"); };
    document.getElementById("_mrCancel").onclick  = () => closeRegenModal();
  } else {
    msg.innerHTML = "This uses <strong>1 credit</strong> and creates a fresh draft.";
    actions.innerHTML = `
      <button class="btn btn-accent" id="_mrConfirm">Regenerate · 1 credit</button>
      <button class="btn"            id="_mrCancel">Cancel</button>`;
    document.getElementById("_mrConfirm").onclick = () => { closeRegenModal(); regenWithCredit("new"); };
    document.getElementById("_mrCancel").onclick  = () => closeRegenModal();
  }
  modal.style.display = "";
}

function closeRegenModal() {
  document.getElementById("regenModal").style.display = "none";
}

async function regenWithCredit(mode) {
  regenMode = mode;
  const savedIdToRestore = (mode === "replace") ? savedAppId : null;

  ["cvEdit", "regen", "saveApp", "download"].forEach(id => {
    const b = document.getElementById(id); if (b) b.disabled = true;
  });
  document.getElementById("stage").style.display = "none";
  const s = document.getElementById("status");
  s.style.display = ""; s.classList.remove("error");
  document.getElementById("cvGenHeader").style.display = "";
  document.getElementById("statusText").style.display = "none";
  document.getElementById("genTrigger").style.display = "none";
  startMilestones(CV_MILESTONES, "cvMilestones");

  let profile;
  try {
    let job;
    ({ profile, job } = await loadProfileAndJob());
    const res = await workerFetch({
      messages: [{ role: "user", content: buildPrompt(profile, job.text, cvPageCount) }],
    }, "/regenerate");

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      const errMsg = res.status === 402
        ? "Not enough credits to regenerate. Buy more to continue."
        : (e?.error?.message || "Regeneration failed — try again.");
      stopMilestones();
      setStatus(errMsg, true);
      regenMode = null;
      return;
    }

    const data = await res.json();
    tailored     = data.tailored;
    generationId = data.generation_id;
    isUnlocked   = true;
    if (savedIdToRestore) savedAppId = savedIdToRestore;
    if (typeof data.credits === "number") updateCreditPill(data.credits);

    resetSaveButtons();
    if (savedIdToRestore) savedAppId = savedIdToRestore;

    stopMilestones();
    document.getElementById("status").style.display = "none";
    showView("cv");
    document.getElementById("lockOverlay")?.remove();
    renderCV(profile, tailored, currentCvTemplate);
    fitCvToPages(tailored, profile, cvPageCount);
    scaleCvMobile();
    renderGaps(tailored.gaps);
    if (typeof tailored.fitScore === "number") renderFitScore(tailored.fitScore, tailored.fitReason);
    if (tailored.interviewPrep) renderInterviewPrep(tailored.interviewPrep);
    document.getElementById("cvEdit").disabled = false;
    document.getElementById("download").disabled = false;
    document.getElementById("saveApp").disabled = false;
    document.getElementById("regen").disabled = false;
    document.getElementById("tabCvIcon").textContent = "✓";
    document.getElementById("tabCvIcon").className = "tab-icon tab-check";
    cvReady = true;
    document.getElementById("tabBar").style.display = "";
    const styleBarR = document.getElementById("styleBar");
    if (styleBarR) styleBarR.style.display = "";

    try {
      const { generateCount = 0 } = await store.get("generateCount");
      await store.set({ generateCount: generateCount + 1 });
    } catch { /* non-critical */ }

    if (mode === "replace") await autoUpdateSaved().catch(() => {});
  } catch (err) {
    stopMilestones();
    setStatus(err.message, true);
    document.getElementById("regen").disabled = false;
  } finally {
    regenMode = null;
  }
}

// ---------- Cover regen ----------

async function handleCoverRegen() {
  const modal   = document.getElementById("regenModal");
  const msg     = document.getElementById("regenModalMsg");
  const actions = document.getElementById("regenModalActions");

  if (savedAppId) {
    msg.innerHTML = "This uses <strong>1 credit</strong>. You have a saved copy of this cover letter.";
    actions.innerHTML = `
      <button class="btn btn-accent" id="_mrReplace">Replace saved · 1 credit</button>
      <button class="btn"            id="_mrNew">Keep saved · 1 credit</button>
      <button class="btn"            id="_mrCancel">Cancel</button>`;
    document.getElementById("_mrReplace").onclick = () => { closeRegenModal(); coverRegenWithCredit("replace"); };
    document.getElementById("_mrNew").onclick     = () => { closeRegenModal(); coverRegenWithCredit("new"); };
    document.getElementById("_mrCancel").onclick  = () => closeRegenModal();
  } else {
    msg.innerHTML = "This uses <strong>1 credit</strong> and creates a new version of your cover letter.";
    actions.innerHTML = `
      <button class="btn btn-accent" id="_mrConfirm">Rewrite · 1 credit</button>
      <button class="btn"            id="_mrCancel">Cancel</button>`;
    document.getElementById("_mrConfirm").onclick = () => { closeRegenModal(); coverRegenWithCredit("new"); };
    document.getElementById("_mrCancel").onclick  = () => closeRegenModal();
  }
  modal.style.display = "";
}

async function coverRegenWithCredit(mode) {
  regenMode = mode;
  const savedIdToRestore = (mode === "replace") ? savedAppId : null;

  ["coverEdit", "coverCopy", "coverRegen", "coverDownload", "saveAppCover"].forEach(id => {
    const b = document.getElementById(id); if (b) b.disabled = true;
  });
  document.getElementById("coverStage").style.display = "none";
  const cs = document.getElementById("coverStatus");
  cs.style.display = ""; cs.classList.remove("error");
  document.getElementById("coverGenHeader").style.display = "";
  document.getElementById("coverStatusText").style.display = "none";
  document.getElementById("coverGenTrigger").style.display = "none";
  startMilestones(COVER_MILESTONES, "coverMilestones");

  let profile;
  try {
    let job;
    ({ profile, job } = await loadProfileAndJob());
    const res = await workerFetch({
      messages: [{ role: "user", content: buildCoverPrompt(profile, job.text) }],
    }, "/regenerate-cover");

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      const errMsg = res.status === 402
        ? "Not enough credits to rewrite. Buy more to continue."
        : (e?.error?.message || "Rewrite failed — try again.");
      stopMilestones();
      document.getElementById("coverStatusText").textContent = errMsg;
      document.getElementById("coverStatusText").style.display = "";
      document.getElementById("coverGenHeader").style.display = "none";
      cs.classList.add("error");
      regenMode = null;
      document.getElementById("coverRegen").disabled = false;
      return;
    }

    const data = await res.json();
    coverText          = data.cover_text;
    coverJobTitle      = data.cover_job_title || coverJobTitle;
    coverGenerationId  = data.cover_generation_id;
    _coverCreatedAt    = new Date().toISOString();
    isCoverUnlocked    = true;
    if (savedIdToRestore) savedAppId = savedIdToRestore;
    if (typeof data.credits === "number") updateCreditPill(data.credits);

    stopMilestones();
    document.getElementById("coverStatus").style.display = "none";
    document.getElementById("coverLockOverlay")?.remove();
    // Show stage BEFORE fit/scale — measurements (scrollHeight, offsetWidth) return
    // 0 while the element is display:none, causing scale(0) and wrong font trimming.
    document.getElementById("coverStage").style.display = "flex";
    renderCover(profile, coverText, coverJobTitle, currentCoverTemplate);
    fitCoverToOnePage(); scaleCoverMobile();
    document.getElementById("coverEdit").disabled = false;
    document.getElementById("coverCopy").disabled = false;
    document.getElementById("coverDownload").disabled = false;
    document.getElementById("coverRegen").disabled = false;
    document.getElementById("saveAppCover").disabled = false;
    document.getElementById("tabCoverIcon").textContent = "✓";
    document.getElementById("tabCoverIcon").className = "tab-icon tab-check";
    coverReady = true;

    if (mode === "replace") await autoUpdateSaved().catch(() => {});
  } catch (err) {
    stopMilestones();
    document.getElementById("coverStatusText").textContent = err.message;
    document.getElementById("coverStatusText").style.display = "";
    document.getElementById("coverGenHeader").style.display = "none";
    const cs2 = document.getElementById("coverStatus");
    if (cs2) cs2.classList.add("error");
    document.getElementById("coverRegen").disabled = false;
  } finally {
    regenMode = null;
  }
}

async function autoUpdateSaved() {
  if (!savedAppId || !tailored) return;
  try {
    const { pendingJob } = await store.get("pendingJob");
    await updateApplication(savedAppId, {
      job_title:       tailored?.jobTitle || "",
      company:         tailored?.company  || "",
      job_text:        pendingJob?.text   || "",
      job_url:         pendingJob?.url    || "",
      fit_score:       tailored?.fitScore ?? null,
      mode:            activeMode,
      tailored:        tailored,
      cover_text:      coverText     || null,
      cover_job_title: coverJobTitle || null,
      cv_html:         isUnlocked      ? (document.getElementById("page")?.innerHTML     || null) : null,
      cover_html:      isCoverUnlocked ? (document.getElementById("coverPage")?.innerHTML || null) : null,
      cv_template:     currentCvTemplate,
      cover_template:  currentCoverTemplate,
      cv_theme:        _currentThemeId,
      cover_theme:     _currentThemeId,
    });
    ["saveApp", "saveAppCover"].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.disabled = false;
      b.textContent = "Saved ✓";
      b.classList.add("btn-saved");
    });
  } catch (err) {
    console.error("Auto-update saved application failed:", err);
  }
}

let savedAppId = null;

async function handleSave(btn) {
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    await ensureSession();
    const { pendingJob } = await store.get("pendingJob");
    savedAppId = await saveApplication({
      job_title:       tailored?.jobTitle || "",
      company:         tailored?.company  || "",
      job_text:        pendingJob?.text   || "",
      job_url:         pendingJob?.url    || "",
      fit_score:       tailored?.fitScore ?? null,
      mode:            activeMode,
      tailored:        tailored,
      cover_text:      coverText     || null,
      cover_job_title: coverJobTitle || null,
      cv_html:         document.getElementById("page")?.innerHTML || null,
      cover_html:      isCoverUnlocked ? (document.getElementById("coverPage")?.innerHTML || null) : null,
      cv_template:     currentCvTemplate,
      cover_template:  currentCoverTemplate,
      cv_theme:        _currentThemeId,
      cover_theme:     _currentThemeId,
    });
    ["saveApp", "saveAppCover"].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.disabled = false;
      b.textContent = "Saved ✓";
      b.classList.add("btn-saved");
    });
  } catch (err) {
    btn.disabled = false; btn.textContent = "Save";
    showToast("Couldn't save: " + err.message, true);
  }
}

async function handleUnsave(btn) {
  if (!savedAppId) return;
  btn.disabled = true; btn.textContent = "Removing…";
  try {
    await deleteApplication(savedAppId);
    savedAppId = null;
    ["saveApp", "saveAppCover"].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.disabled = false;
      b.textContent = "Save";
      b.classList.remove("btn-saved");
    });
  } catch (err) {
    btn.disabled = false; btn.textContent = "Saved ✓";
    showToast("Couldn't remove: " + err.message, true);
  }
}

function resetSaveButtons() {
  savedAppId        = null;
  isUnlocked        = false;
  isCoverUnlocked   = false;
  generationId      = null;
  coverGenerationId = null;
  ["saveApp", "saveAppCover"].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = true;
    b.textContent = "Save";
    b.classList.remove("btn-saved");
  });
}

["saveApp", "saveAppCover"].forEach(id => {
  document.getElementById(id).addEventListener("click", function () {
    if (this.classList.contains("btn-saved")) handleUnsave(this);
    else handleSave(this);
  });
});

setupEditToggle("cvEdit", "page", async () => {
  if (savedAppId && isUnlocked) {
    await updateApplication(savedAppId, {
      cv_html: document.getElementById("page")?.innerHTML || null,
    }).catch(() => {});
  }
});

setupEditToggle("coverEdit", "coverPage", async () => {
  const pageEl = document.getElementById("coverPage");
  const bodyEl = pageEl?.querySelector(".cl-body");
  if (pageEl) {
    if (bodyEl) {
      const fromParas = [...bodyEl.querySelectorAll("p")]
        .map(p => p.innerText.trim()).filter(Boolean).join("\n\n");
      coverText = fromParas || bodyEl.innerText.trim();
    } else {
      coverText = pageEl.innerText.trim();
    }
  }
  fitCoverToOnePage(); scaleCoverMobile();
  if (savedAppId && isCoverUnlocked) {
    await updateApplication(savedAppId, {
      cover_html:  document.getElementById("coverPage")?.innerHTML || null,
      cover_text:  coverText || null,
    }).catch(() => {});
  }
});

// ---------- Cover letter ----------

function buildCoverPrompt(profile, jobText) {
  const p = profile.personal || {};
  const roles = (profile.roles || []).map(r =>
    `- ${r.title || "—"} at ${r.company || "—"}: ${r.background || "(no detail)"}`
  ).join("\n");
  const skills = (profile.skills || []).join(", ");

  return `Write a cover letter for this candidate, tailored to the job posting.

JOB POSTING:
"""
${jobText.slice(0, 6000)}
"""

CANDIDATE: ${p.firstName || ""} ${p.lastName || ""}
SKILLS: ${skills}
EXPERIENCE:
${roles}

STYLE — follow exactly:
- Open with a confident, direct hook. Do NOT start with "I am writing to apply for". Lead with something showing you understand the company's problem, mission, or stage.
- Sell the candidate's value specifically: reference 2–3 concrete things from their real experience that directly match what THIS role needs.
- Tone: can-do and startup-friendly — ambitious, energetic, low ego, high ownership. Sound like a real person, not a template.
- Show genuine, specific enthusiasm for THIS company/role.
- TONE MATCHING: mirror the posting's voice.
- Close with a confident, forward-looking line that expresses clear intent.
- BANNED PHRASES: "I am a passionate", "I am excited to", "I would be a great fit", "I look forward to hearing from you", "I am writing to apply".
- Keep it tight: roughly 200–280 words total, in 3–4 short paragraphs.

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "jobTitle": "the exact job title from the posting (the role being applied for)",
  "body": "the cover letter body only — no salutation, no date, no sign-off; separate paragraphs with a blank line"
}`;
}

let coverText = "";
let _coverCreatedAt = "";

// ---------- Mini-preview helpers ----------

function buildMockCvTailored(profile) {
  const roles = profile.roles || [];
  return {
    jobTitle: "Your Target Role",
    summary: "A results-driven professional with proven experience tailored to your industry. Your personalised summary will be crafted after generation to highlight the most relevant aspects of your background.",
    summaryBullets: [],
    skills: (profile.skills || []).slice(0, 8),
    roles: roles.slice(0, Math.min(3, roles.length)).map((r, i) => ({
      ref: i,
      bullets: ["Your tailored bullet points will appear here after generation."],
    })),
  };
}

function buildMockCoverBody() {
  return "Your tailored cover letter will be crafted here after generation.\n\nThe letter will highlight the most relevant aspects of your background for this specific role, matching the tone and requirements of the job posting.\n\nA compelling closing statement will express your intent and readiness to contribute.";
}

const _MINI_FALLBACK_PROFILE = {
  personal: { firstName: "Your", lastName: "Name", location: "City, Country", phone: "+1 234 567 890", email: "you@example.com", linkedin: "" },
  photo: { include: false },
  roles: [
    { title: "Senior Role Title", company: "Company Name", location: "City", start: "2021", end: "Present", background: "" },
    { title: "Previous Role", company: "Previous Company", location: "City", start: "2019", end: "2021", background: "" },
    { title: "Earlier Role", company: "Earlier Company", location: "City", start: "2017", end: "2019", background: "" },
  ],
  skills: ["Skill One", "Skill Two", "Skill Three", "Skill Four", "Skill Five", "Skill Six", "Skill Seven", "Skill Eight"],
  education: [{ degree: "Bachelor of Science", institution: "University Name", start: "2013", end: "2017" }],
  languages: [],
};

function renderMiniPreview(which) {
  try {
    if (which === "cv") {
      const el = document.getElementById("cvMiniPage");
      if (!el) return;
      renderCV(_MINI_FALLBACK_PROFILE, buildMockCvTailored(_MINI_FALLBACK_PROFILE), currentCvTemplate, el);
      el.style.setProperty("--cv-accent", _currentThemeHex);
    } else {
      const el = document.getElementById("coverMiniPage");
      if (!el) return;
      renderCover(_MINI_FALLBACK_PROFILE, buildMockCoverBody(), "Your Target Role", currentCoverTemplate, el);
      el.style.setProperty("--cv-accent", _currentThemeHex);
    }
  } catch (err) { console.error("renderMiniPreview error:", err); return; }

  store.get("profile").then(({ profile }) => {
    if (!profile) return;
    try {
      if (which === "cv") {
        const el = document.getElementById("cvMiniPage");
        if (el) { renderCV(profile, buildMockCvTailored(profile), currentCvTemplate, el); el.style.setProperty("--cv-accent", _currentThemeHex); }
      } else {
        const el = document.getElementById("coverMiniPage");
        if (el) { renderCover(profile, buildMockCoverBody(), "Your Target Role", currentCoverTemplate, el); el.style.setProperty("--cv-accent", _currentThemeHex); }
      }
    } catch (err) { console.error("renderMiniPreview (real profile) error:", err); }
  }).catch(() => {});
}

// ---------- Cover letter renderers ----------

function renderCoverClassic(profile, body, jobTitle, targetEl) {
  const p = profile.personal || {};
  const photo = profile.photo || {};
  const showPhoto = photo.include !== false && photo.dataUrl;
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const title = jobTitle || "";
  const contactLines = [p.location, p.phone, p.email].filter(Boolean);
  const paras = body.split(/\n{2,}|\n/).map(s => s.trim()).filter(Boolean);

  (targetEl || document.getElementById("coverPage")).innerHTML = `
    <div class="cl-card">
      ${showPhoto ? `<img class="cl-photo" src="${photo.dataUrl}" alt="">` : ""}
      <div class="cl-id">
        <div class="cl-name">${escHtml(name)}</div>
        ${title ? `<div class="cl-role">${escHtml(title)}</div>` : ""}
        <div class="cl-contact">${contactLines.map(escHtml).join("<br>")}</div>
      </div>
    </div>
    <div class="cl-salutation">Dear Hiring Manager,</div>
    <div class="cl-body">${paras.map(t => `<p>${escHtml(t)}</p>`).join("")}</div>
    <div class="cl-sign">Sincerely,<br><span class="n">${escHtml(p.firstName || name)}</span></div>
  `;
}

function renderCoverMinimalLetterhead(profile, body, jobTitle, targetEl) {
  const p = profile.personal || {};
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const contactLines = [p.location, p.phone, p.email].filter(Boolean);
  const paras = body.split(/\n{2,}|\n/).map(s => s.trim()).filter(Boolean);

  (targetEl || document.getElementById("coverPage")).innerHTML = `
    <div class="cl-ml-name">${escHtml(name)}</div>
    <div class="cl-ml-contact">${contactLines.map(escHtml).join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</div>
    <hr class="cl-ml-rule">
    <div class="cl-salutation">Dear Hiring Manager,</div>
    <div class="cl-body">${paras.map(t => `<p>${escHtml(t)}</p>`).join("")}</div>
    <div class="cl-sign">Sincerely,<br><span class="n">${escHtml(p.firstName || name)}</span></div>
  `;
}

function renderCoverSplitHeader(profile, body, jobTitle, targetEl) {
  const p = profile.personal || {};
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const title = jobTitle || "";
  const contactLines = [p.location, p.phone, p.email].filter(Boolean);
  const paras = body.split(/\n{2,}|\n/).map(s => s.trim()).filter(Boolean);

  (targetEl || document.getElementById("coverPage")).innerHTML = `
    <div class="cl-sph-header">
      <div>
        <div class="cl-sph-name">${escHtml(name)}</div>
        ${title ? `<div class="cl-sph-title">${escHtml(title)}</div>` : ""}
      </div>
      <div class="cl-sph-contact">${contactLines.map(escHtml).join("<br>")}</div>
    </div>
    <hr class="cl-sph-divider">
    <div class="cl-salutation">Dear Hiring Manager,</div>
    <div class="cl-body">${paras.map(t => `<p>${escHtml(t)}</p>`).join("")}</div>
    <div class="cl-sign">Sincerely,<br><span class="n">${escHtml(p.firstName || name)}</span></div>
  `;
}

function renderCoverExecutiveFormal(profile, body, jobTitle, targetEl) {
  const p = profile.personal || {};
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const contactLines = [p.location, p.phone, p.email].filter(Boolean);
  const paras = body.split(/\n{2,}|\n/).map(s => s.trim()).filter(Boolean);
  const today = (_coverCreatedAt ? new Date(_coverCreatedAt) : new Date())
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  (targetEl || document.getElementById("coverPage")).innerHTML = `
    <div class="cl-ef-name">${escHtml(name)}</div>
    <div class="cl-ef-contact">${contactLines.map(escHtml).join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</div>
    <div class="cl-ef-dbl"></div>
    <div class="cl-ef-date">${today}</div>
    <div class="cl-salutation">Dear Hiring Manager,</div>
    <div class="cl-body">${paras.map(t => `<p>${escHtml(t)}</p>`).join("")}</div>
    <div class="cl-sign">Yours sincerely,<br><span class="n">${escHtml(name)}</span></div>
  `;
}

function renderCover(profile, body, jobTitle, templateId, targetEl) {
  const id = templateId || "classic";
  const target = targetEl || document.getElementById("coverPage");
  target.className = "cv-page cover-page cv-tpl-cover-" + id;
  switch (id) {
    case "minimal-letterhead": renderCoverMinimalLetterhead(profile, body, jobTitle, target); break;
    case "split-header":       renderCoverSplitHeader(profile, body, jobTitle, target);       break;
    case "executive-formal":   renderCoverExecutiveFormal(profile, body, jobTitle, target);   break;
    default:                   renderCoverClassic(profile, body, jobTitle, target);            break;
  }
}

function escHtml(s) {
  return (s == null ? "" : String(s))
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function coverOverflows() {
  const A4_PX = 297 / 25.4 * 96;
  return document.getElementById("coverPage").scrollHeight > A4_PX + 2;
}

function fitCoverToOnePage() {
  const page = document.getElementById("coverPage");
  page.style.fontSize = "";

  // Same iOS Safari fix as fitToOnePage — measure with position:fixed so
  // scrollHeight reflects the 210mm-wide layout, not the container width.
  const isMobile = window.innerWidth < 860;
  let _prevPosition = "", _prevTop = "", _prevLeft = "";
  if (isMobile) {
    _prevPosition     = page.style.position;
    _prevTop          = page.style.top;
    _prevLeft         = page.style.left;
    page.style.position = "fixed";
    page.style.top      = "-9999px";
    page.style.left     = "0";
  }

  let size = 11;
  while (coverOverflows() && size > 9.5) {
    size -= 0.25;
    page.style.fontSize = size.toFixed(2) + "pt";
  }
  const result = { fit: !coverOverflows(), shrunk: size < 11 };

  if (isMobile) {
    page.style.position = _prevPosition;
    page.style.top      = _prevTop;
    page.style.left     = _prevLeft;
  }
  return result;
}

async function generateCover() {
  isCoverUnlocked   = false;
  coverText         = "";
  coverGenerationId = null;

  ["coverEdit", "coverCopy", "coverRegen"].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = true; });

  const btn = document.getElementById("tabCover");
  document.getElementById("tabCv").disabled = true;
  document.getElementById("cvControls").style.display = "none";
  document.getElementById("coverControls").style.display = "contents";
  document.getElementById("stage").style.display = "none";
  document.getElementById("status").style.display = "none";
  document.getElementById("coverStage").style.display = "none";
  document.getElementById("tabCv")?.classList.remove("tab-active");
  document.getElementById("tabCover")?.classList.add("tab-active");
  if (btn) btn.disabled = true;

  const cs = document.getElementById("coverStatus");
  cs.style.display = ""; cs.classList.remove("error");
  document.getElementById("coverGenHeader").style.display = "";
  document.getElementById("coverStatusText").style.display = "none";
  document.getElementById("coverGenTrigger").style.display = "none";
  const coverPanelGen = document.getElementById("coverPreGenPanel");
  if (coverPanelGen) coverPanelGen.style.display = "none";
  startMilestones(COVER_MILESTONES, "coverMilestones");

  let profile, job;
  try {
    ({ profile, job } = await loadProfileAndJob());
  } catch (err) {
    stopMilestones();
    document.getElementById("coverStatus").style.display = "none";
    return setStatus(err.message, true);
  }

  try {
    const res = await workerFetch({
      messages: [{ role: "user", content: buildCoverPrompt(profile, job.text) }],
    }, "/cover");

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("Rate limited — wait a moment and try again.");
      throw new Error(e?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    coverGenerationId = data.cover_generation_id;
    coverJobTitle     = data.cover_job_title || "";
    _coverCreatedAt   = new Date().toISOString();
    const coverPreview = data.cover_preview  || "";

    document.getElementById("coverStatus").style.display = "none";
    showView("cover");

    renderCover(profile, coverPreview, coverJobTitle, currentCoverTemplate);
    addCoverLockOverlay();
    document.getElementById("tabCoverIcon").textContent = "🔒";
    document.getElementById("tabCoverIcon").className = "tab-icon tab-cross";

    coverReady = true;
    document.getElementById("coverRegen").disabled = false;
    stopMilestones();
  } catch (err) {
    stopMilestones();
    document.getElementById("coverStatus").style.display = "none";
    setStatus(err.message, true);
    document.getElementById("coverRegen").disabled = false;
  } finally {
    regenMode = null;
    document.getElementById("tabCv").disabled = false;
    if (btn) btn.disabled = false;
  }
}

document.getElementById("tabCv").addEventListener("click", () => {
  if (cvReady) { document.getElementById("status").style.display = "none"; showView("cv"); }
  // else: generation in progress — do nothing, don't re-show the pre-gen panel
});
document.getElementById("tabCover").addEventListener("click", () => {
  if (coverReady) { document.getElementById("status").style.display = "none"; showView("cover"); }
  else showCoverPrompt();
});
document.getElementById("coverRegen").addEventListener("click", handleCoverRegen);
document.getElementById("coverDownload").addEventListener("click", () => printOnly("cover"));
document.getElementById("coverCopy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(coverText);
    const b = document.getElementById("coverCopy");
    const t = b.textContent; b.textContent = "Copied ✓";
    setTimeout(() => (b.textContent = t), 1500);
  } catch { showToast("Couldn't copy — select the text and copy manually.", true); }
});

// ---------- Template / theme switchers ----------

document.addEventListener("click", async function(e) {
  const btn = e.target.closest(".tpl-swatch");
  if (!btn) return;
  const container = btn.closest(".tpl-swatches");
  if (!container) return;
  const tpl = btn.dataset.tpl;
  const id  = container.id;

  if (id === "cvTplSwatches" || id === "cvTplSwatchesInline") {
    currentCvTemplate = tpl;
    updateTplSwatches("cvTplSwatches",       currentCvTemplate);
    updateTplSwatches("cvTplSwatchesInline", currentCvTemplate);
    savePrefs({ cvTemplate: currentCvTemplate });
    if (isUnlocked && tailored) {
      const { profile } = await store.get("profile");
      renderCV(profile, tailored, currentCvTemplate);
      fitCvToPages(tailored, profile, cvPageCount);
      scaleCvMobile();
    }
    renderMiniPreview("cv");
  } else if (id === "coverTplSwatches" || id === "coverTplSwatchesInline") {
    currentCoverTemplate = tpl;
    updateTplSwatches("coverTplSwatches",       currentCoverTemplate);
    updateTplSwatches("coverTplSwatchesInline", currentCoverTemplate);
    savePrefs({ coverTemplate: currentCoverTemplate });
    if (isCoverUnlocked && coverText) {
      const { profile } = await store.get("profile");
      renderCover(profile, coverText, coverJobTitle, currentCoverTemplate);
      fitCoverToOnePage(); scaleCoverMobile();
    }
    renderMiniPreview("cover");
  }
});


// Page count swatch toggle (pre-gen panel on result page — used when loading a saved app).
document.getElementById("pageSwatches")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-pages]");
  if (!btn) return;
  cvPageCount = Number(btn.dataset.pages);
  document.querySelectorAll("#pageSwatches .tpl-swatch").forEach(b =>
    b.classList.toggle("tpl-swatch-active", Number(b.dataset.pages) === cvPageCount)
  );
  savePrefs({ pageCount: cvPageCount });
});

// ---------- Init ----------

// Wire the "Buy credits" button in the result bar to the shared shop modal.
document.getElementById("resultBuyCredits")?.addEventListener("click", () => {
  if (typeof openShopModal === "function") openShopModal();
});

(async function start() {
  // Install shop modal early so it's ready before the user can click.
  if (typeof _installShopModal === "function") _installShopModal();

  // Auth guard.
  const currentUser = await getUser().catch(() => null);
  if (!currentUser?.email) {
    await store.remove("supabaseSession").catch(() => {});
    location.href = "/app/auth.html";
    return;
  }

  // Load saved preferences.
  try {
    const { cvPrefs = {} } = await store.get("cvPrefs");
    currentCvTemplate    = cvPrefs.cvTemplate    || "classic";
    currentCoverTemplate = cvPrefs.coverTemplate || "classic";
    cvPageCount          = Number(cvPrefs.pageCount) || 1;
    applyTheme(cvPrefs.themeId || "blue-indigo");
    renderThemeSwatches(cvPrefs.themeId || "blue-indigo");
    updateTplSwatches("cvTplSwatches",       currentCvTemplate);
    updateTplSwatches("cvTplSwatchesInline", currentCvTemplate);
    updateTplSwatches("coverTplSwatches",       currentCoverTemplate);
    updateTplSwatches("coverTplSwatchesInline", currentCoverTemplate);
    document.querySelectorAll("#pageSwatches .tpl-swatch").forEach(b =>
      b.classList.toggle("tpl-swatch-active", Number(b.dataset.pages) === cvPageCount)
    );
  } catch { /* non-critical */ }

  renderMiniPreview("cv");

  // Check for saved application to display.
  let saved = null;
  try {
    const s = await store.get("savedApplication");
    if (s.savedApplication) {
      saved = s.savedApplication;
      await store.remove("savedApplication");
    }
  } catch { /* ignore */ }

  if (saved) {
    try {
      const { profile } = await store.get("profile");
      if (!profile) throw new Error("No profile found. Open Settings to set up your details.");

      tailored          = saved.tailored        || {};
      coverText         = saved.cover_text      || "";
      coverJobTitle     = saved.cover_job_title || "";
      isUnlocked        = true;
      savedAppId        = saved.id             || null;
      _coverCreatedAt   = saved.created_at     || "";

      if (saved.job_url) {
        const link = document.getElementById("jobLink");
        if (link) { link.href = saved.job_url; link.style.display = ""; }
      }

      fetchAndShowCreditPill();
      document.getElementById("status").style.display = "none";
      showView("cv");

      if (saved.cv_html) {
        document.getElementById("page").innerHTML = saved.cv_html;
        document.getElementById("page").className = "cv-page cv-tpl-" + currentCvTemplate;
      } else {
        renderCV(profile, tailored, currentCvTemplate);
        fitCvToPages(tailored, profile, cvPageCount);
      }
      scaleCvMobile();
      renderGaps(tailored.gaps);
      if (typeof tailored.fitScore === "number") renderFitScore(tailored.fitScore, tailored.fitReason);
      if (tailored.interviewPrep) renderInterviewPrep(tailored.interviewPrep);
      document.getElementById("cvEdit").disabled = false;
      document.getElementById("regen").disabled = false;
      document.getElementById("download").disabled = false;
      const saveAppBtn = document.getElementById("saveApp");
      saveAppBtn.disabled = false;
      saveAppBtn.textContent = "Saved ✓";
      saveAppBtn.classList.add("btn-saved");
      cvReady = true;
      document.getElementById("tabBar").style.display = "";
      document.getElementById("tabCvIcon").textContent = "✓";
      document.getElementById("tabCvIcon").className = "tab-icon tab-check";
      const styleBarSaved = document.getElementById("styleBar");
      if (styleBarSaved) styleBarSaved.style.display = "";

      if (coverText) {
        if (saved.cover_html) {
          document.getElementById("coverPage").innerHTML = saved.cover_html;
          document.getElementById("coverPage").className = "cv-page cover-page cv-tpl-cover-" + currentCoverTemplate;
        } else {
          renderCover(profile, coverText, coverJobTitle, currentCoverTemplate);
          fitCoverToOnePage(); scaleCoverMobile();
        }
        coverReady = true;
        isCoverUnlocked = true;
        document.getElementById("coverEdit").disabled = false;
        document.getElementById("coverCopy").disabled = false;
        document.getElementById("coverRegen").disabled = false;
        document.getElementById("coverDownload").disabled = false;
        const saveAppCoverBtn = document.getElementById("saveAppCover");
        saveAppCoverBtn.disabled = false;
        saveAppCoverBtn.textContent = "Saved ✓";
        saveAppCoverBtn.classList.add("btn-saved");
        document.getElementById("tabCoverIcon").textContent = "✓";
        document.getElementById("tabCoverIcon").className = "tab-icon tab-check";
      }
    } catch (err) {
      setStatus(err.message, true);
    }
    return;
  }

  // Normal flow: use pendingJob + profile.
  try {
    const s = await store.get(["profile", "pendingJob"]);
    // Apply template/theme/pageCount from generate page if passed.
    if (s.pendingJob?.pageCount) {
      cvPageCount = Number(s.pendingJob.pageCount);
    }
    if (s.pendingJob?.template) {
      currentCvTemplate = s.pendingJob.template;
      updateTplSwatches("cvTplSwatches",       currentCvTemplate);
      updateTplSwatches("cvTplSwatchesInline", currentCvTemplate);
    }
    if (s.pendingJob?.theme) {
      const matchedTheme = COLOR_THEMES.find(t => t.hex === s.pendingJob.theme);
      if (matchedTheme) {
        applyTheme(matchedTheme.id);
        renderThemeSwatches(matchedTheme.id);
        renderThemeSwatchesInline("cv", matchedTheme.id);
      }
    }
    if (s.pendingJob?.url) {
      const link = document.getElementById("jobLink");
      if (link) { link.href = s.pendingJob.url; link.style.display = ""; }
    }
  } catch { /* defaults */ }

  fetchAndShowCreditPill();

  document.getElementById("tabBar").style.display = "";
  document.getElementById("tabCvIcon").textContent = "○";
  document.getElementById("tabCvIcon").className = "tab-icon";
  document.getElementById("tabCoverIcon").textContent = "○";
  document.getElementById("tabCoverIcon").className = "tab-icon";
  // Template/colour/mode already chosen on generate.html — start immediately.
  generate();
})();
