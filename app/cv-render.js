// CvBFF — CV renderer.
// Takes the saved profile + the AI's tailored content and builds the
// single-column CV into #page, then trims to one page if needed.

function h(s) {
  return (s == null ? "" : String(s))
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- Shared HTML helpers ----------

function buildRolesHtml(tailored, profile) {
  return (tailored.roles || []).map(rt => {
    const src = profile.roles[rt.ref] || {};
    const startStr = [src.startMonth, src.start].filter(Boolean).join(" ");
    const endStr   = [src.endMonth,   src.end  ].filter(Boolean).join(" ");
    const dates    = [startStr, endStr].filter(Boolean).join(" – ");
    const dateLine = [dates, src.jobType].filter(Boolean).join(" · ");
    const company  = [src.company, src.location].filter(Boolean).join(", ");
    const bullets = (rt.bullets || []).filter(Boolean);
    return `
      <div class="cv-role">
        <div class="cv-role-head">
          <div><span class="cv-role-title">${h(src.title)}</span>${company ? ` — <span class="cv-role-company">${h(company)}</span>` : ""}</div>
          <div class="cv-role-dates">${h(dateLine)}</div>
        </div>
        ${bullets.length ? `<ul>${bullets.map(b => `<li>${h(b)}</li>`).join("")}</ul>` : ""}
      </div>`;
  }).join("");
}

function buildEduHtml(profile) {
  return (profile.education || []).map(e => `
    <div class="cv-edu">
      <span class="d">${h(e.degree)}</span><br>
      <span class="cv-meta-line">${h(e.institution)}${(e.start || e.end) ? ` · ${h([e.start, e.end].filter(Boolean).join(" – "))}` : ""}</span>
    </div>`).join("");
}

function buildLangHtml(profile) {
  return (profile.languages || [])
    .map(l => `${h(l.name)} — ${h(l.level)}`).join('<span class="sep">&nbsp;·&nbsp;</span>');
}

function buildContactHtml(profile, sep) {
  const p = profile.personal || {};
  const sepSpan = `<span class="sep">${sep}</span>`;
  const parts = [p.location, p.phone, p.email, p.linkedin].filter(Boolean).map(h);
  const portfolio = (profile.portfolio || []).filter(x => x.url);
  portfolio.forEach(x => parts.push(h(x.label ? `${x.label}: ${x.url}` : x.url)));
  return parts.join(sepSpan);
}

function buildCertsHtml(profile) {
  const items = (profile.certifications || []).filter(c => c.name);
  if (!items.length) return "";
  return items.map(c => {
    const meta = [c.issuer, c.year].filter(Boolean).map(h).join(", ");
    return `<span class="cv-compact-item">${h(c.name)}${meta ? ` <span class="cv-meta-line">(${meta})</span>` : ""}</span>`;
  }).join('<span class="sep">&nbsp;·&nbsp;</span>');
}

function buildAwardsHtml(profile) {
  const items = (profile.awards || []).filter(a => a.title);
  if (!items.length) return "";
  return items.map(a => {
    const meta = [a.org, a.year].filter(Boolean).map(h).join(", ");
    return `<span class="cv-compact-item">${h(a.title)}${meta ? ` <span class="cv-meta-line">(${meta})</span>` : ""}</span>`;
  }).join('<span class="sep">&nbsp;·&nbsp;</span>');
}


// ---------- CV template render functions ----------

function renderCVClassic(profile, tailored, targetEl) {
  const p = profile.personal || {};
  const photo = profile.photo || {};
  const showPhoto = photo.include !== false && photo.dataUrl;

  const contact = buildContactHtml(profile, '&nbsp;·&nbsp;');
  const summaryBullets = (tailored.summaryBullets || []).filter(Boolean);
  const skills = (tailored.skills || []).filter(Boolean);
  const rolesHtml    = buildRolesHtml(tailored, profile);
  const eduHtml      = buildEduHtml(profile);
  const langHtml     = buildLangHtml(profile);
  const certsHtml    = buildCertsHtml(profile);
  const awardsHtml   = buildAwardsHtml(profile);

  (targetEl || document.getElementById("page")).innerHTML = `
    <div class="cv-head">
      ${showPhoto ? `<img class="cv-photo" src="${photo.dataUrl}" alt="">` : ""}
      <div class="cv-id">
        <div class="cv-name">${h(p.firstName)} ${h(p.lastName)}</div>
        <div class="cv-title">${h(tailored.jobTitle)}</div>
        <div class="cv-contact">${contact}</div>
      </div>
    </div>
    <hr class="cv-rule">

    <div class="cv-section">
      <h3>Summary</h3>
      <p class="cv-summary">${h(tailored.summary)}</p>
      ${summaryBullets.length ? `<ul style="margin:6px 0 0;padding-left:15px">${summaryBullets.map(b => `<li>${h(b)}</li>`).join("")}</ul>` : ""}
    </div>

    ${skills.length ? `<div class="cv-section"><h3>Skills</h3><p class="cv-skills">${skills.map(h).join('<span class="sep">&nbsp;·&nbsp;</span>')}</p></div>` : ""}

    <div class="cv-section"><h3>Work experience</h3>${rolesHtml}</div>

${eduHtml       ? `<div class="cv-section"><h3>Education</h3>${eduHtml}</div>` : ""}
    ${certsHtml     ? `<div class="cv-section"><h3>Certifications</h3><p class="cv-skills">${certsHtml}</p></div>` : ""}
    ${awardsHtml    ? `<div class="cv-section"><h3>Awards &amp; Achievements</h3><p class="cv-skills">${awardsHtml}</p></div>` : ""}
    ${langHtml      ? `<div class="cv-section"><h3>Languages</h3><p class="cv-skills">${langHtml}</p></div>` : ""}
  `;
}

function renderCVExecutive(profile, tailored, targetEl) {
  const p = profile.personal || {};
  const photo = profile.photo || {};
  const showPhoto = photo.include !== false && photo.dataUrl;

  const contact = buildContactHtml(profile, "&nbsp;&nbsp;·&nbsp;&nbsp;");
  const summaryBullets = (tailored.summaryBullets || []).filter(Boolean);
  const skills = (tailored.skills || []).filter(Boolean);
  const rolesHtml     = buildRolesHtml(tailored, profile);
  const eduHtml       = buildEduHtml(profile);
  const langHtml      = buildLangHtml(profile);
  const certsHtml  = buildCertsHtml(profile);
  const awardsHtml = buildAwardsHtml(profile);

  const sh = (label) => `<div class="cv-section"><h3>${label}</h3><div class="cv-section-rule"></div>`;

  (targetEl || document.getElementById("page")).innerHTML = `
    <div class="cv-head">
      ${showPhoto ? `<img class="cv-photo" src="${photo.dataUrl}" alt="">` : ""}
      <div class="cv-id">
        <div class="cv-name">${h(p.firstName)} ${h(p.lastName)}</div>
        <div class="cv-title">${h(tailored.jobTitle)}</div>
        <div class="cv-contact">${contact}</div>
      </div>
    </div>
    <hr class="cv-rule">

    ${sh("Profile")}
      <p class="cv-summary">${h(tailored.summary)}</p>
      ${summaryBullets.length ? `<ul style="margin:6px 0 0;padding-left:15px">${summaryBullets.map(b => `<li>${h(b)}</li>`).join("")}</ul>` : ""}
    </div>

    ${skills.length ? `${sh("Core Competencies")}<p class="cv-skills">${skills.map(h).join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</p></div>` : ""}

    ${sh("Professional Experience")}${rolesHtml}</div>

${eduHtml       ? `${sh("Education")}${eduHtml}</div>` : ""}
    ${certsHtml     ? `${sh("Certifications")}<p class="cv-skills">${certsHtml}</p></div>` : ""}
    ${awardsHtml    ? `${sh("Awards &amp; Achievements")}<p class="cv-skills">${awardsHtml}</p></div>` : ""}
    ${langHtml      ? `${sh("Languages")}<p class="cv-skills">${langHtml}</p></div>` : ""}
  `;
}

function renderCVMinimal(profile, tailored, targetEl) {
  const p = profile.personal || {};
  const photo = profile.photo || {};
  const showPhoto = photo.include !== false && photo.dataUrl;

  const contact = buildContactHtml(profile, '&nbsp;·&nbsp;');
  const summaryBullets = (tailored.summaryBullets || []).filter(Boolean);
  const skills = (tailored.skills || []).filter(Boolean);
  const rolesHtml     = buildRolesHtml(tailored, profile);
  const eduHtml       = buildEduHtml(profile);
  const langHtml      = buildLangHtml(profile);
  const certsHtml  = buildCertsHtml(profile);
  const awardsHtml = buildAwardsHtml(profile);

  (targetEl || document.getElementById("page")).innerHTML = `
    <div class="cv-head">
      ${showPhoto ? `<img class="cv-photo" src="${photo.dataUrl}" alt="">` : ""}
      <div class="cv-id">
        <div class="cv-name">${h(p.firstName)} ${h(p.lastName)}</div>
        <div class="cv-title">${h(tailored.jobTitle)}</div>
        <div class="cv-contact">${contact}</div>
      </div>
    </div>
    <hr class="cv-rule">

    <div class="cv-section">
      <h3>Summary</h3>
      <p class="cv-summary">${h(tailored.summary)}</p>
      ${summaryBullets.length ? `<ul style="margin:6px 0 0;padding-left:15px">${summaryBullets.map(b => `<li>${h(b)}</li>`).join("")}</ul>` : ""}
    </div>

    ${skills.length ? `<div class="cv-section"><h3>Skills</h3><p class="cv-skills">${skills.map(h).join(", ")}</p></div>` : ""}

    <div class="cv-section"><h3>Work experience</h3>${rolesHtml}</div>

${eduHtml       ? `<div class="cv-section"><h3>Education</h3>${eduHtml}</div>` : ""}
    ${certsHtml     ? `<div class="cv-section"><h3>Certifications</h3><p class="cv-skills">${certsHtml}</p></div>` : ""}
    ${awardsHtml    ? `<div class="cv-section"><h3>Awards &amp; Achievements</h3><p class="cv-skills">${awardsHtml}</p></div>` : ""}
    ${langHtml      ? `<div class="cv-section"><h3>Languages</h3><p class="cv-skills">${langHtml}</p></div>` : ""}
  `;
}

function renderCVThickUnderline(profile, tailored, targetEl) {
  const p = profile.personal || {};
  const photo = profile.photo || {};
  const showPhoto = photo.include !== false && photo.dataUrl;

  const contact = buildContactHtml(profile, '&nbsp;·&nbsp;');
  const summaryBullets = (tailored.summaryBullets || []).filter(Boolean);
  const skills = (tailored.skills || []).filter(Boolean);
  const rolesHtml     = buildRolesHtml(tailored, profile);
  const eduHtml       = buildEduHtml(profile);
  const langHtml      = buildLangHtml(profile);
  const certsHtml  = buildCertsHtml(profile);
  const awardsHtml = buildAwardsHtml(profile);

  const pillsHtml = skills.map(s => `<span class="cv-tu-pill">${h(s)}</span>`).join(" ");

  (targetEl || document.getElementById("page")).innerHTML = `
    <div class="cv-head">
      ${showPhoto ? `<img class="cv-photo" src="${photo.dataUrl}" alt="">` : ""}
      <div class="cv-id">
        <div class="cv-name">${h(p.firstName)} ${h(p.lastName)}</div>
        <div class="cv-title">${h(tailored.jobTitle)}</div>
        <div class="cv-contact">${contact}</div>
      </div>
    </div>

    <div class="cv-section">
      <h3>Summary</h3>
      <p class="cv-summary">${h(tailored.summary)}</p>
      ${summaryBullets.length ? `<ul style="margin:6px 0 0;padding-left:15px">${summaryBullets.map(b => `<li>${h(b)}</li>`).join("")}</ul>` : ""}
    </div>

    ${skills.length ? `<div class="cv-section"><h3>Skills</h3><div style="margin-top:4px">${pillsHtml}</div></div>` : ""}

    <div class="cv-section"><h3>Work experience</h3>${rolesHtml}</div>

${eduHtml       ? `<div class="cv-section"><h3>Education</h3>${eduHtml}</div>` : ""}
    ${certsHtml     ? `<div class="cv-section"><h3>Certifications</h3><p class="cv-skills">${certsHtml}</p></div>` : ""}
    ${awardsHtml    ? `<div class="cv-section"><h3>Awards &amp; Achievements</h3><p class="cv-skills">${awardsHtml}</p></div>` : ""}
    ${langHtml      ? `<div class="cv-section"><h3>Languages</h3><p class="cv-skills">${langHtml}</p></div>` : ""}
  `;
}

// ---------- Main dispatcher ----------

// Stores the last template used so fitToOnePage can re-render with the same template.
let _lastCvTemplateId = "classic";

// Render the CV. `tailored` shape:
// { jobTitle, summary, summaryBullets:[], skills:[], roles:[{bullets:[]}] }
// roles[] aligns by index with profile.roles[], ordered most→least relevant
// by the model (each item carries its original index in `ref`).
function renderCV(profile, tailored, templateId, targetEl) {
  _lastCvTemplateId = templateId || "classic";
  const target = targetEl || document.getElementById("page");
  target.className = "cv-page cv-tpl-" + _lastCvTemplateId;
  switch (_lastCvTemplateId) {
    case "executive":       renderCVExecutive(profile, tailored, target);      break;
    case "minimal":         renderCVMinimal(profile, tailored, target);         break;
    case "thick-underline": renderCVThickUnderline(profile, tailored, target);  break;
    default:                renderCVClassic(profile, tailored, target);          break;
  }
}

function overflowsPages(n) {
  const page = document.getElementById("page");
  const A4_PX = 297 / 25.4 * 96; // 297mm at 96dpi
  return page.scrollHeight > n * A4_PX + 2;
}

// Fit the CV to n A4 pages. Strategy:
//   1. Set min-height so the page fills the target height.
//   2. Reduce font size (10.2pt → 9pt) and tighten line-height if content overflows.
//   3. For 1-page mode only: trim trailing bullets as a last resort.
// Uses position:fixed off-screen on mobile to avoid iOS Safari scrollHeight bugs.
// Returns { cut, shrunk }.
function fitCvToPages(tailored, profile, pages = 1) {
  const page = document.getElementById("page");
  page.style.fontSize   = "";
  page.style.lineHeight = "";
  page.style.minHeight  = pages > 1 ? (pages * 297) + "mm" : "";

  const isMobile = typeof window !== "undefined" && window.innerWidth < 860;
  let _prevPosition = "", _prevTop = "", _prevLeft = "";
  if (isMobile) {
    _prevPosition        = page.style.position;
    _prevTop             = page.style.top;
    _prevLeft            = page.style.left;
    page.style.position  = "fixed";
    page.style.top       = "-9999px";
    page.style.left      = "0";
  }

  let shrunk = false;

  // Step 1: shrink font size.
  let fontSize = 10.2;
  while (overflowsPages(pages) && fontSize > 9.0) {
    fontSize = Math.round((fontSize - 0.2) * 10) / 10;
    page.style.fontSize = fontSize.toFixed(1) + "pt";
    shrunk = true;
  }

  // Step 2: tighten line-height.
  let lineH = 1.4;
  while (overflowsPages(pages) && lineH > 1.2) {
    lineH = Math.round((lineH - 0.05) * 100) / 100;
    page.style.lineHeight = lineH.toFixed(2);
    shrunk = true;
  }

  // Step 3: trim bullets — only for 1-page CVs.
  let cut = 0;
  if (pages === 1) {
    let guard = 0;
    while (overflowsPages(1) && guard++ < 60) {
      const roles = tailored.roles || [];
      let target = -1, floorPass = false;
      for (let i = roles.length - 1; i >= 0; i--) {
        if ((roles[i].bullets || []).length > 1) { target = i; break; }
      }
      if (target === -1) {
        if ((tailored.summaryBullets || []).length > 0) {
          tailored.summaryBullets.pop(); floorPass = true;
        } else break;
      }
      if (!floorPass && target >= 0) roles[target].bullets.pop();
      cut++;
      renderCV(profile, tailored, _lastCvTemplateId);
      if (shrunk) {
        page.style.fontSize   = fontSize.toFixed(1) + "pt";
        page.style.lineHeight = lineH.toFixed(2);
      }
    }
  }

  if (isMobile) {
    page.style.position = _prevPosition;
    page.style.top      = _prevTop;
    page.style.left     = _prevLeft;
  }
  return { cut, shrunk };
}
