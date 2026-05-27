// CvBFF — settings page logic (web version).

const LEVELS    = ["Native", "Fluent", "Professional", "Conversational", "Basic"];
const MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const JOB_TYPES = ["Full-Time","Part-Time","Freelance","Internship","Volunteer"];
let photoDataUrl = "";
let isDirty = false;

let selectedSkills  = [];
let skillsActiveCat = "All";

window.addEventListener("beforeunload", (e) => {
  if (!isDirty) return;
  e.preventDefault();
  e.returnValue = "";
});

// ---------- Repeatable item builders ----------

function languageItem(data = {}) {
  const el = document.createElement("div");
  el.className = "item lang-item";
  el.setAttribute("draggable", "true");
  const opts = LEVELS.map(l => `<option ${data.level === l ? "selected" : ""}>${l}</option>`).join("");
  el.innerHTML = `
    <div class="item-head">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <button type="button" class="btn-del">Remove</button>
    </div>
    <div class="grid">
      <div class="field"><label>Language</label><input type="text" class="lang-name" placeholder="e.g. English" value="${esc(data.name || "")}"></div>
      <div class="field"><label>Level</label><select class="lang-level">${opts}</select></div>
    </div>`;
  el.querySelector(".btn-del").addEventListener("click", () => { el.remove(); isDirty = true; });
  return el;
}

function educationItem(data = {}) {
  const el = document.createElement("div");
  el.className = "item edu-item";
  el.innerHTML = `
    <div class="item-head"><span class="tag">Education</span><button type="button" class="btn-del">Remove</button></div>
    <div class="grid">
      <div class="field full"><label>Institution</label><input type="text" class="edu-inst" placeholder="e.g. University or school name" value="${esc(data.institution || "")}"></div>
      <div class="field full"><label>Degree</label><input type="text" class="edu-degree" placeholder="e.g. BSc Business Administration" value="${esc(data.degree || "")}"></div>
      <div class="field"><label>Year started</label><input type="text" class="edu-start" placeholder="e.g. 2018" value="${esc(data.start || "")}"></div>
      <div class="field"><label>Year ended</label><input type="text" class="edu-end" placeholder="e.g. 2021" value="${esc(data.end || "")}"></div>
    </div>`;
  el.querySelector(".btn-del").addEventListener("click", () => { el.remove(); isDirty = true; });
  return el;
}

function roleItem(data = {}) {
  const mOpts = (sel) => `<option value=""></option>` + MONTHS.map(m => `<option${sel === m ? " selected" : ""}>${m}</option>`).join("");
  const tOpts = (sel) => `<option value=""></option>` + JOB_TYPES.map(t => `<option${sel === t ? " selected" : ""}>${t}</option>`).join("");
  const el = document.createElement("div");
  el.className = "item role-item";
  el.innerHTML = `
    <div class="item-head"><span class="tag">Role</span><button type="button" class="btn-del">Remove</button></div>
    <div class="grid">
      <div class="field"><label>Job title</label><input type="text" class="role-title" placeholder="e.g. Marketing Coordinator" value="${esc(data.title || "")}"></div>
      <div class="field"><label>Company</label><input type="text" class="role-company" placeholder="e.g. Company name" value="${esc(data.company || "")}"></div>
      <div class="field"><label>Location (optional)</label><input type="text" class="role-location" placeholder="e.g. City, Country" value="${esc(data.location || "")}"></div>
      <div class="field"></div>
      <div class="field full">
        <div class="role-dates-row">
          <div class="date-seg"><label>Start</label><div class="date-pair"><select class="role-start-month">${mOpts(data.startMonth)}</select><input type="text" class="role-start" placeholder="Year" value="${esc(data.start || "")}"></div></div>
          <span class="date-dash">–</span>
          <div class="date-seg"><label>End</label><div class="date-pair"><select class="role-end-month">${mOpts(data.endMonth)}</select><input type="text" class="role-end" placeholder="Year / Present" value="${esc(data.end || "")}"></div></div>
          <div class="date-seg date-type"><label>Type</label><select class="role-type">${tOpts(data.jobType)}</select></div>
        </div>
      </div>
      <div class="field full"><label>What you did — tasks, tools, achievements</label><textarea class="role-background" placeholder="Describe what you actually did here — your day-to-day tasks, the tools you used, and your main achievements (with numbers where you can). Be specific: this is the raw material the AI tailors into bullet points.">${esc(data.background || "")}</textarea><p class="field-counter role-bg-counter">0 / 4,000 chars</p></div>
    </div>`;
  el.querySelector(".btn-del").addEventListener("click", () => { el.remove(); isDirty = true; });
  const bgArea    = el.querySelector(".role-background");
  const bgCounter = el.querySelector(".role-bg-counter");
  function _updateBgCounter() {
    const len = bgArea.value.length;
    bgCounter.textContent = `${len.toLocaleString()} / 4,000 chars`;
    bgCounter.style.color = len >= 3800 ? "var(--danger)" : len >= 3000 ? "#b45309" : "var(--muted)";
  }
  bgArea.addEventListener("input", _updateBgCounter);
  _updateBgCounter();
  return el;
}

function certItem(data = {}) {
  const el = document.createElement("div");
  el.className = "item cert-item";
  el.innerHTML = `
    <div class="item-head"><span class="tag">Certification</span><button type="button" class="btn-del">Remove</button></div>
    <div class="grid">
      <div class="field full"><label>Certification name</label><input type="text" class="cert-name" placeholder="e.g. AWS Certified Solutions Architect" value="${esc(data.name || "")}"></div>
      <div class="field"><label>Issuing organisation</label><input type="text" class="cert-issuer" placeholder="e.g. Amazon Web Services" value="${esc(data.issuer || "")}"></div>
      <div class="field"><label>Year</label><input type="text" class="cert-year" placeholder="e.g. 2023" value="${esc(data.year || "")}"></div>
    </div>`;
  el.querySelector(".btn-del").addEventListener("click", () => { el.remove(); isDirty = true; });
  return el;
}

function awardItem(data = {}) {
  const el = document.createElement("div");
  el.className = "item award-item";
  el.innerHTML = `
    <div class="item-head"><span class="tag">Award</span><button type="button" class="btn-del">Remove</button></div>
    <div class="grid">
      <div class="field full"><label>Award / achievement title</label><input type="text" class="award-title" placeholder="e.g. Employee of the Year" value="${esc(data.title || "")}"></div>
      <div class="field"><label>Organisation</label><input type="text" class="award-org" placeholder="e.g. Company name or body" value="${esc(data.org || "")}"></div>
      <div class="field"><label>Year</label><input type="text" class="award-year" placeholder="e.g. 2022" value="${esc(data.year || "")}"></div>
    </div>`;
  el.querySelector(".btn-del").addEventListener("click", () => { el.remove(); isDirty = true; });
  return el;
}

function portfolioItem(data = {}) {
  const el = document.createElement("div");
  el.className = "item portfolio-item";
  el.innerHTML = `
    <div class="item-head"><span class="tag">Link</span><button type="button" class="btn-del">Remove</button></div>
    <div class="grid">
      <div class="field"><label>Label</label><input type="text" class="portfolio-label" placeholder="e.g. GitHub" value="${esc(data.label || "")}"></div>
      <div class="field"><label>URL</label><input type="url" class="portfolio-url" placeholder="e.g. github.com/yourname" value="${esc(data.url || "")}"></div>
    </div>`;
  el.querySelector(".btn-del").addEventListener("click", () => { el.remove(); isDirty = true; });
  return el;
}

// ---------- Language drag-and-drop ----------

function enableDragSort(container) {
  let dragging = null;
  container.addEventListener("dragstart", (e) => {
    dragging = e.target.closest(".lang-item");
    if (!dragging) return;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => dragging.classList.add("dragging"), 0);
  });
  container.addEventListener("dragend", () => {
    if (dragging) { dragging.classList.remove("dragging"); isDirty = true; }
    dragging = null;
  });
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!dragging) return;
    const over = e.target.closest(".lang-item");
    if (!over || over === dragging) return;
    const rect = over.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) container.insertBefore(dragging, over);
    else over.after(dragging);
  });
}

// ---------- Skills picker ----------

function addSkill(name) {
  name = name.trim();
  if (!name || selectedSkills.includes(name) || selectedSkills.length >= 50) return;
  selectedSkills.push(name);
  renderSkillChips();
  renderSkillsGrid();
  updateSkillsCounter();
  updateCompletion();
  isDirty = true;
}

function removeSkill(name) {
  selectedSkills = selectedSkills.filter(s => s !== name);
  renderSkillChips();
  renderSkillsGrid();
  updateSkillsCounter();
  updateCompletion();
  isDirty = true;
}

function renderSkillChips() {
  const container = document.getElementById("skillsChips");
  if (!container) return;
  container.innerHTML = "";
  selectedSkills.forEach(skill => {
    const chip = document.createElement("span");
    chip.className = "skill-chip";
    chip.innerHTML = `${esc(skill)}<button type="button" aria-label="Remove ${esc(skill)}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => removeSkill(skill));
    container.appendChild(chip);
  });
}

function renderSkillsGrid() {
  const grid = document.getElementById("skillsGrid");
  if (!grid) return;
  const query = (document.getElementById("skillsSearch")?.value || "").trim().toLowerCase();

  let skills = [];
  if (skillsActiveCat === "All") {
    const seen = new Set();
    Object.values(SKILLS_DATA).forEach(arr =>
      arr.forEach(s => { if (!seen.has(s)) { seen.add(s); skills.push(s); } })
    );
  } else {
    skills = SKILLS_DATA[skillsActiveCat] || [];
  }

  if (query) skills = skills.filter(s => s.toLowerCase().includes(query));

  const unselected = skills.filter(s => !selectedSkills.includes(s));
  const alreadyOn  = skills.filter(s =>  selectedSkills.includes(s));
  const sorted = [...unselected, ...alreadyOn];

  if (sorted.length === 0) {
    grid.innerHTML = query
      ? `<p class="skills-empty">No matches — click <strong>+ Add</strong> to add "<em>${esc(query)}</em>" as a custom skill.</p>`
      : `<p class="skills-empty">No skills in this category.</p>`;
    return;
  }

  grid.innerHTML = "";
  const cap = (skillsActiveCat === "All" && !query) ? 80 : sorted.length;
  sorted.slice(0, cap).forEach(skill => {
    const isOn = selectedSkills.includes(skill);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skill-pill" + (isOn ? " skill-pill-on" : "");
    btn.textContent = skill;
    if (!isOn) btn.addEventListener("click", () => addSkill(skill));
    grid.appendChild(btn);
  });

  if (skillsActiveCat === "All" && !query && sorted.length > cap) {
    const note = document.createElement("p");
    note.className = "skills-empty";
    note.textContent = `Showing 80 of ${sorted.length} — search or pick a category to see more.`;
    grid.appendChild(note);
  }
}

function initSkillsUI() {
  const catsEl = document.getElementById("skillsCats");
  if (!catsEl) return;

  ["All", ...Object.keys(SKILLS_DATA)].forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skill-cat" + (cat === skillsActiveCat ? " skill-cat-active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      skillsActiveCat = cat;
      catsEl.querySelectorAll(".skill-cat").forEach(b =>
        b.classList.toggle("skill-cat-active", b.textContent === cat)
      );
      renderSkillsGrid();
    });
    catsEl.appendChild(btn);
  });

  const searchEl = document.getElementById("skillsSearch");
  searchEl?.addEventListener("input", () => renderSkillsGrid());
  searchEl?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = searchEl.value.trim();
    if (q) { addSkill(q); searchEl.value = ""; renderSkillsGrid(); }
  });

  document.getElementById("addCustomSkillBtn")?.addEventListener("click", () => {
    const q = searchEl?.value.trim();
    if (q) { addSkill(q); searchEl.value = ""; renderSkillsGrid(); }
  });

  renderSkillsGrid();
}

// ---------- Collect DOM → data object ----------

function _clip(s, max) { return s == null ? "" : String(s).slice(0, max); }

function collect() {
  return {
    mode: document.getElementById("mode").value,
    personal: {
      firstName: _clip(val("firstName"), 100),
      lastName:  _clip(val("lastName"),  100),
      location:  _clip(val("location"),  200),
      phone:     _clip(val("phone"),     50),
      email:     _clip(val("email"),     254),
      linkedin:  _clip(val("linkedin"),  300),
    },
    photo: { dataUrl: photoDataUrl, include: document.getElementById("photoInclude").checked },
    skills: selectedSkills.slice(0, 50),
    languages: [...document.querySelectorAll(".lang-item")].map(it => ({
      name:  _clip(it.querySelector(".lang-name").value.trim(), 80),
      level: it.querySelector(".lang-level").value,
    })).filter(l => l.name).slice(0, 20),
    education: [...document.querySelectorAll(".edu-item")].map(it => ({
      institution: _clip(it.querySelector(".edu-inst").value.trim(),   200),
      degree:      _clip(it.querySelector(".edu-degree").value.trim(), 200),
      start:       _clip(it.querySelector(".edu-start").value.trim(),  20),
      end:         _clip(it.querySelector(".edu-end").value.trim(),    20),
    })).filter(e => e.institution || e.degree).slice(0, 10),
    roles: [...document.querySelectorAll(".role-item")].map(it => ({
      title:       _clip(it.querySelector(".role-title").value.trim(),      150),
      company:     _clip(it.querySelector(".role-company").value.trim(),    150),
      location:    _clip(it.querySelector(".role-location").value.trim(),   150),
      startMonth:  it.querySelector(".role-start-month").value,
      start:       _clip(it.querySelector(".role-start").value.trim(),      20),
      endMonth:    it.querySelector(".role-end-month").value,
      end:         _clip(it.querySelector(".role-end").value.trim(),        20),
      jobType:     it.querySelector(".role-type").value,
      background:  _clip(it.querySelector(".role-background").value.trim(), 4_000),
    })).filter(r => r.title || r.company || r.background).slice(0, 20),
    certifications: [...document.querySelectorAll(".cert-item")].map(it => ({
      name:   _clip(it.querySelector(".cert-name").value.trim(),   200),
      issuer: _clip(it.querySelector(".cert-issuer").value.trim(), 200),
      year:   _clip(it.querySelector(".cert-year").value.trim(),   20),
    })).filter(c => c.name).slice(0, 20),
    awards: [...document.querySelectorAll(".award-item")].map(it => ({
      title: _clip(it.querySelector(".award-title").value.trim(), 200),
      org:   _clip(it.querySelector(".award-org").value.trim(),   200),
      year:  _clip(it.querySelector(".award-year").value.trim(),  20),
    })).filter(a => a.title).slice(0, 20),
    portfolio: [...document.querySelectorAll(".portfolio-item")].map(it => ({
      label: _clip(it.querySelector(".portfolio-label").value.trim(), 100),
      url:   _clip(it.querySelector(".portfolio-url").value.trim(),   500),
    })).filter(p => p.url).slice(0, 10),
  };
}

// ---------- Populate DOM from saved data ----------

function populate(data) {
  if (data.mode) setVal("mode", data.mode);
  setVal("firstName", data.personal?.firstName);
  setVal("lastName",  data.personal?.lastName);
  setVal("location",  data.personal?.location);
  setVal("phone",     data.personal?.phone);
  setVal("email",     data.personal?.email);
  setVal("linkedin",  data.personal?.linkedin);

  selectedSkills = (data.skills || []).slice(0, 50);
  renderSkillChips();
  renderSkillsGrid();

  photoDataUrl = data.photo?.dataUrl || "";
  document.getElementById("photoInclude").checked = data.photo?.include !== false;
  renderPhoto();

  const langs  = document.getElementById("languages");
  const edu    = document.getElementById("education");
  const certs  = document.getElementById("certifications");
  const awards = document.getElementById("awards");
  const port   = document.getElementById("portfolio");
  const roles  = document.getElementById("roles");
  langs.innerHTML = ""; edu.innerHTML = ""; roles.innerHTML = "";
  if (certs)  certs.innerHTML  = "";
  if (awards) awards.innerHTML = "";
  if (port)   port.innerHTML   = "";

  (data.languages?.length ? data.languages : [{}]).forEach(l => langs.appendChild(languageItem(l)));
  (data.education?.length ? data.education : [{}]).forEach(e => edu.appendChild(educationItem(e)));
  (data.roles?.length     ? data.roles     : [{}]).forEach(r => roles.appendChild(roleItem(r)));
  (data.certifications || []).forEach(c => certs?.appendChild(certItem(c)));
  (data.awards         || []).forEach(a => awards?.appendChild(awardItem(a)));
  (data.portfolio      || []).forEach(p => port?.appendChild(portfolioItem(p)));
}

// ---------- Photo ----------

function renderPhoto() {
  const preview   = document.getElementById("photoPreview");
  const removeBtn = document.getElementById("photoRemove");
  if (photoDataUrl) {
    preview.innerHTML = `<img src="${photoDataUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    removeBtn.style.display = "";
  } else {
    preview.textContent = "＋";
    removeBtn.style.display = "none";
  }
}

document.getElementById("photoPick").addEventListener("click", () => document.getElementById("photoInput").click());
document.getElementById("photoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("Photo must be under 2 MB. Please choose a smaller image.", true);
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { photoDataUrl = reader.result; renderPhoto(); isDirty = true; };
  reader.readAsDataURL(file);
});
document.getElementById("photoRemove").addEventListener("click", () => { photoDataUrl = ""; renderPhoto(); isDirty = true; });

// ---------- Add buttons ----------

document.getElementById("addLanguage").addEventListener("click", () =>
  document.getElementById("languages").appendChild(languageItem())
);
document.getElementById("addEducation").addEventListener("click", () =>
  document.getElementById("education").appendChild(educationItem())
);
document.getElementById("addRole").addEventListener("click", () =>
  document.getElementById("roles").appendChild(roleItem())
);
document.getElementById("addCert").addEventListener("click", () =>
  document.getElementById("certifications").appendChild(certItem())
);
document.getElementById("addAward").addEventListener("click", () =>
  document.getElementById("awards").appendChild(awardItem())
);
document.getElementById("addPortfolio").addEventListener("click", () =>
  document.getElementById("portfolio").appendChild(portfolioItem())
);

// ---------- Save ----------

document.getElementById("save").addEventListener("click", async () => {
  try {
    const profile = collect();
    await store.set({ profile });
    ensureSession().then(() => saveProfile(profile)).catch(e => console.warn("Supabase profile sync failed:", e));
    isDirty = false;
    const s = document.getElementById("status");
    s.classList.add("show");
    setTimeout(() => s.classList.remove("show"), 1800);
    if (profile.roles?.length || profile.skills?.length || profile.personal?.firstName) {
      document.getElementById("gettingStarted").style.display = "none";
    }
    updateCompletion();
  } catch (err) {
    showToast("Could not save: " + err.message, true);
  }
});

// ---------- Delete account ----------

document.getElementById("deleteAccount").addEventListener("click", async () => {
  const confirmed = confirm(
    "Are you sure you want to delete your account?\n\nThis will permanently remove your profile, all saved applications, and your credit balance. This cannot be undone."
  );
  if (!confirmed) return;

  const btn      = document.getElementById("deleteAccount");
  const statusEl = document.getElementById("deleteStatus");
  btn.disabled = true;
  btn.textContent = "Deleting…";
  statusEl.style.display = "none";

  try {
    await deleteAccount();
    await store.clear().catch(() => {});
    statusEl.textContent = "Account deleted. You can close this page.";
    statusEl.style.color = "#1d6f5c";
    statusEl.style.display = "";
    btn.style.display = "none";
  } catch (err) {
    statusEl.textContent = err.message || "Something went wrong — please try again or contact support@cvbff.com.";
    statusEl.style.display = "";
    btn.disabled = false;
    btn.textContent = "Delete my account";
  }
});

// ---------- Skills counter ----------

function updateSkillsCounter() {
  const el = document.getElementById("skillsCounter");
  if (!el) return;
  const count = selectedSkills.length;
  el.textContent = `${count} / 50 skills`;
  el.style.color = count >= 48 ? "var(--danger)" : count >= 40 ? "#b45309" : "var(--muted)";
}

// ---------- Profile completion ----------

function updateCompletion() {
  const hasRoleWithBg = [...document.querySelectorAll(".role-background")]
    .some(t => t.value.trim().length > 50);
  const hasEdu = [...document.querySelectorAll(".edu-item")]
    .some(it => it.querySelector(".edu-inst")?.value.trim());

  const criteria = [
    { label: "first name",        met: !!val("firstName").trim() },
    { label: "last name",         met: !!val("lastName").trim()  },
    { label: "email",             met: !!val("email").trim()     },
    { label: "5+ skills",         met: selectedSkills.length >= 5 },
    { label: "work experience",   met: hasRoleWithBg },
    { label: "education",         met: hasEdu },
    { label: "LinkedIn or photo", met: !!val("linkedin").trim() || !!photoDataUrl },
  ];

  const metCount = criteria.filter(c => c.met).length;
  const pct = Math.round((metCount / criteria.length) * 100);

  const pctEl  = document.getElementById("completionPct");
  const fillEl = document.getElementById("completionFill");
  const hintEl = document.getElementById("completionHint");
  if (!pctEl) return;

  pctEl.textContent  = `${pct}%`;
  fillEl.style.width = `${pct}%`;
  fillEl.style.background =
    pct === 100 ? "#1d9e6b" : pct >= 57 ? "var(--accent)" : "#b45309";

  const missing = criteria.filter(c => !c.met).map(c => c.label);
  if (pct === 100) {
    hintEl.textContent = "✓ Profile complete — great CV quality expected.";
    hintEl.style.color = "#1d9e6b";
  } else {
    const shown = missing.slice(0, 3);
    const extra = missing.length - shown.length;
    hintEl.textContent = `Still needed: ${shown.join(", ")}${extra > 0 ? ` + ${extra} more` : ""}.`;
    hintEl.style.color = "var(--muted)";
  }
}

// ---------- Helpers ----------
function val(id)       { return document.getElementById(id)?.value ?? ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el && v != null) el.value = v; }
function esc(s)        { return (s == null ? "" : String(s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// ---------- Init ----------

(async function init() {
  const user = await authGuard();
  if (!user) return;

  renderNav("settings");
  enableDragSort(document.getElementById("languages"));
  initSkillsUI();

  let data = {};
  try {
    const cloudData = await loadProfile();
    if (cloudData) {
      data = cloudData;
      await store.set({ profile: data });
    } else {
      const stored = await store.get("profile");
      data = stored.profile || {};
    }
  } catch {
    try {
      const stored = await store.get("profile");
      data = stored.profile || {};
    } catch { /* first run */ }
  }

  populate(data);
  updateCompletion();
  updateSkillsCounter();
  isDirty = false;

  const isEmpty = !data.roles?.length && !data.skills?.length && !data.personal?.firstName;
  document.getElementById("gettingStarted").style.display = isEmpty ? "" : "none";

  document.addEventListener("input",  () => { isDirty = true; updateCompletion(); updateSkillsCounter(); });
  document.addEventListener("change", () => { isDirty = true; updateCompletion(); });
})();
