// ─────────────────────────────────────────────────────────────────────────────
// shared/epa-form.js
//
// The EPA evaluation form engine, shared by every program's form page.
//
// WHY THIS EXISTS
//   This code used to live inline in index.html. A second program needed the
//   same form, and copying the page would have produced two 800-line engines
//   that drift apart - the exact duplication shared/ exists to prevent, and the
//   thing CLAUDE.md explicitly forbids. So the engine moved here and each page
//   became configuration.
//
// WHAT A PAGE MUST DEFINE BEFORE LOADING THIS FILE
//   PROGRAM        - 'fm' | 'am'; the key into PROGRAMS in shared/definitions.js
//   SUPABASE_URL   - project REST endpoint
//   SUPABASE_ANON  - anon key (public by design; RLS is the access control)
//
//   and must load, in order: text-matching.js, definitions.js,
//   faculty-roster.js, detail-options.js, then this file.
//
// WHAT A PAGE MUST CONTAIN IN ITS MARKUP
//   #view-landing, #view-form, #form-content-landing, #form-content,
//   #nav-form-btn, .nav-btn buttons, and the two near-miss modals
//   (#detail-dup-modal, #eval-dup-modal) with the ids their handlers read.
//
// EVERY MILESTONE PATH IS PROGRAM-SCOPED. activeEpas(), buildScoresDetail() and
// computeMilestoneScores() all take PROGRAM, and saveSubmission() stamps it on
// the row. A fellow's PC1 and a resident's PC1 are different competencies that
// share a code; nothing here may average them together.
//
// NOTE ON DELETED CODE: index.html previously defined renderFormLanding(),
// selectRotation(), showSuccess() and showView() twice, and renderEPAForm() was
// unreachable because the later selectRotation() delegated elsewhere. Only the
// live definitions were carried over. Do not reintroduce the shadowed copies.
// ─────────────────────────────────────────────────────────────────────────────

// Refuse to run rather than half-render. The page's own guard has already shown
// the reader a message by this point; this stops init() from throwing a second,
// less legible error on top of it.
if (typeof PROGRAM === 'undefined' || typeof ROTATIONS_BY_PROGRAM === 'undefined'
    || typeof loadFaculty === 'undefined' || typeof normalize === 'undefined') {
  throw new Error('epa-form.js: the page must define PROGRAM and load text-matching.js, definitions.js, faculty-roster.js and detail-options.js first');
}

// ── Wording ──────────────────────────────────────────────────────────────────
// The form says "resident" to a residency and "fellow" to a fellowship. The
// nouns come from PROGRAMS so the two pages never disagree about what a learner
// is called.
const LEARNER   = programInfo(PROGRAM).learner;    // resident | fellow
const LEARNERS  = programInfo(PROGRAM).learners;   // residents | fellows
const LEARNER_C = LEARNER.charAt(0).toUpperCase() + LEARNER.slice(1);

// ── Learner roster ───────────────────────────────────────────────────────────
// Scoped to this program. Without the filter a fellow appears in the residency
// picker and vice versa.
let RESIDENTS = [];
let residentsLoaded = false;

async function loadResidents() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/residents?select=name&program=eq.${PROGRAM}&active=eq.true&order=sort_order.asc,name.asc`,
      {
        headers: {
          'apikey':        SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    RESIDENTS = rows.map(r => r.name).filter(n => n && n.trim());
    if (RESIDENTS.length === 0) RESIDENTS = [`[No ${LEARNERS} found — check the Supabase residents table]`];
  } catch (e) {
    console.error(`Failed to load ${LEARNERS}:`, e);
    RESIDENTS = ['[Could not load — check Supabase connection]'];
  }
  residentsLoaded = true;
}

// ── State ────────────────────────────────────────────────────────────────────
let selectedRotation = null;

// ── Navigation ───────────────────────────────────────────────────────────────
function goHome() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-landing').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn').classList.add('active');
  renderFormLanding();
}

function showForm() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-form').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-form-btn').classList.add('active');
}

function showView(name) {
  if (name === 'landing' || name === 'home') goHome();
  else if (name === 'form') showForm();
}

// ── Landing (rotation selector) ──────────────────────────────────────────────
function renderFormLanding() {
  selectedRotation = null;
  const el = document.getElementById('form-content-landing') || document.getElementById('form-content');
  const rotationNames = rotationNamesFor(PROGRAM);

  // A real name never starts with "[" — loadResidents() uses that shape for its
  // placeholders, so this counts people rather than error messages.
  const rosterCount = RESIDENTS.filter(r => !r.startsWith('[')).length;

  // An empty roster is reported as a problem, not as a successful load of
  // nothing. It is the state a new program sits in until someone is added to the
  // residents table, and "✓ 0 fellows loaded" reads like everything is fine.
  const residentStatus = !residentsLoaded
    ? `<div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--slate-light);margin-bottom:16px">
        <div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></div>
        Loading ${LEARNER} roster&hellip;
       </div>`
    : rosterCount === 0
    ? `<div style="font-size:12px;color:var(--slate);background:#FDF6E3;border-left:3px solid var(--gold,#B8912F);padding:10px 12px;margin-bottom:16px;line-height:1.5">
        <strong>No ${LEARNERS} on the roster yet.</strong> An evaluation cannot be submitted until
        ${LEARNERS} are added to the Supabase <code>residents</code> table with
        <code>program = '${PROGRAM}'</code>.
       </div>`
    : `<div style="font-size:11px;color:var(--slate-light);letter-spacing:0.06em;margin-bottom:14px">
        ✓ ${rosterCount} ${LEARNERS} loaded
       </div>`;

  // A program with no rotations defined yet would otherwise render an empty grid
  // that looks like a loading failure.
  const grid = rotationNames.length
    ? `<div class="rotation-grid">
        ${rotationNames.map(r => `
          <button class="rotation-btn" onclick="selectRotationForm('${r.replace(/'/g, "\\'")}')">${r}</button>
        `).join('')}
      </div>`
    : `<div style="font-size:13px;color:var(--slate-light);line-height:1.6">
        No rotations are configured for this program yet.
       </div>`;

  el.innerHTML = `
    <div class="rotation-selector">
      <h3>Select a Rotation to Begin</h3>
      ${residentStatus}
      ${grid}
    </div>
  `;
}

function selectRotationForm(name) {
  selectedRotation = name;
  showForm();
  const target = document.getElementById('form-content');
  target.innerHTML = '';
  renderEPAFormInto(name, target);
  window.scrollTo(0, 0);
}

// Kept because the rotation buttons and some older links call it by this name.
function selectRotation(name) {
  selectRotationForm(name);
}

// ── Which procedure / which subspecialty ─────────────────────────────────────
//
// Some rotations describe a shape of encounter rather than a subject, so they
// ask one extra question. Everything else renders nothing here. Driven by
// ROTATION_DETAIL_BY_PROGRAM, which is empty for programs that ask nothing.
//
// A type-ahead over a live list rather than a fixed dropdown: typing something
// genuinely new adds it for the next person, and a near-miss is offered before a
// second spelling is created. Same contract as the evaluator field.
function detailFieldMarkup(rotationName) {
  const cfg = rotationDetailFor(PROGRAM, rotationName);
  if (!cfg) return '';
  const n = pickableDetailOptions(cfg.category).length;
  const status = detailOptionsLoaded
    ? `<div class="roster-status">${escFaculty(cfg.hint)} &middot; ${n} on the list</div>`
    : `<div class="roster-status">Loading the list&hellip;</div>`;
  return `
        <div class="form-group">
          <label>${escFaculty(cfg.label)} *</label>
          <input type="text" id="field-rotation-detail" list="rotationDetailList" autocomplete="off"
                 placeholder="Start typing&hellip;" required>
          <datalist id="rotationDetailList">${detailDatalistOptions(cfg.category)}</datalist>
          ${status}
        </div>`;
}

// The typed value, or null when this rotation collects no detail. Returns
// undefined when the rotation asks and nothing was entered, which the caller
// treats as a validation failure — distinct from "not applicable".
function readRotationDetail(rotationName) {
  if (!rotationDetailFor(PROGRAM, rotationName)) return null;
  const el = document.getElementById('field-rotation-detail');
  const v = (el?.value || '').trim();
  return v || undefined;
}

// ── The form itself ──────────────────────────────────────────────────────────
function renderEPAFormInto(rotationName, el) {
  const epas = activeEpas(PROGRAM, rotationName);

  const scaleOpts = [
    { val: 0, label: 'Not Yet Entrustable', color: '#5C7488' },
    { val: 1, label: 'Complete Supervision', color: '#4E6E85' },
    { val: 2, label: 'Partial Supervision', color: '#41667C' },
    { val: 3, label: 'Minimal Supervision', color: '#355B74' },
    { val: 4, label: 'As if Independent', color: '#264A6A' },
    { val: 5, label: 'Aspirational', color: '#1A2744' },
    { val: 'na', label: 'N/A', color: '#68727E' },
  ];

  el.innerHTML = `
    <div class="form-header">
      <div class="rotation-label">EPA Evaluation</div>
      <h2><strong>${rotationName}</strong></h2>
      <p>After directly observing this ${LEARNER}, please rate the level of supervision you believe this ${LEARNER} requires for each activity listed below. Please provide the ${LEARNER} with verbal feedback as well.</p>
    </div>

    <div class="evaluator-card">
      <h3>Evaluator Information</h3>
      <div class="form-grid three">
        <div class="form-group" style="grid-column: 1 / -1">
          <label>${LEARNER_C} Being Evaluated *</label>
          <select id="field-resident" required>
            <option value="">&mdash; Select ${LEARNER_C} &mdash;</option>
            ${RESIDENTS.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Your Full Name *</label>
          <input type="text" id="field-evaluator-name" list="evaluatorList" autocomplete="off"
            placeholder="Start typing your name&hellip;" required
            oninput="onEvaluatorInput()">
          <datalist id="evaluatorList">${facultyDatalistOptions()}</datalist>
          ${facultyRosterStatus()}
        </div>
        <div class="form-group">
          <label>Supervision Date *</label>
          <input type="date" id="field-date-start" required>
        </div>
        ${detailFieldMarkup(rotationName)}
      </div>
    </div>

    <div class="scale-legend">
      <h4>Entrustment Scale Reference</h4>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px; margin-top:4px">
        <div style="display:flex; gap:10px; align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:0;background:#5C7488;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;margin-top:1px">0</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--slate)">Not Yet Entrustable</div><div style="font-size:11px;color:var(--slate-light);line-height:1.4">Not yet able to perform this activity safely, even with the supervisor directing care.</div></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:0;background:#4E6E85;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;margin-top:1px">1</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--slate)">Complete Supervision</div><div style="font-size:11px;color:var(--slate-light);line-height:1.4">Requires proactive, continuous guidance. Supervisor must be physically present and directing care.</div></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:0;background:#41667C;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;margin-top:1px">2</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--slate)">Partial Supervision</div><div style="font-size:11px;color:var(--slate-light);line-height:1.4">Can perform with supervisor readily available. Needs regular check-ins and co-management.</div></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:0;background:#355B74;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;margin-top:1px">3</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--slate)">Minimal Supervision</div><div style="font-size:11px;color:var(--slate-light);line-height:1.4">Performs independently with supervisor available if needed. Reactive supervision only.</div></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:0;background:#264A6A;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;margin-top:1px">4</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--slate)">As if Independent</div><div style="font-size:11px;color:var(--slate-light);line-height:1.4">Performs independently. Supervisor reviews after the fact &mdash; oversight only.</div></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:0;background:#1A2744;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;margin-top:1px">5</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--slate)">Aspirational</div><div style="font-size:11px;color:var(--slate-light);line-height:1.4">Can supervise others performing this activity.</div></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:0;background:#68727E;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;flex-shrink:0;margin-top:1px">N/A</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--slate)">Not Applicable</div><div style="font-size:11px;color:var(--slate-light);line-height:1.4">This activity was not observed during the supervision period.</div></div>
        </div>
      </div>
    </div>

    ${epas.map((epa, i) => `
      <div class="epa-question">
        <div class="question-header">
          <div class="question-num">${i + 1}</div>
          <div class="question-text">I trust this ${LEARNER} to&hellip; ${epa.text}</div>
        </div>
        <div class="question-context">${epa.context}</div>
        <div class="scale-options">
          ${scaleOpts.map(o => `
            <div class="scale-option" data-val="${o.val}">
              <input type="radio" name="epa-${epa.id}" id="epa-${epa.id}-${o.val}" value="${o.val}">
              <label for="epa-${epa.id}-${o.val}">
                <div class="scale-pip"></div>
                <div class="scale-label">${o.val === 'na' ? 'N/A' : o.val}</div>
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}

    <div class="narrative-card">
      <h3>Narrative Comments</h3>
      <textarea id="field-narrative" placeholder="Required — describe specific observed behaviors, strengths, and areas for improvement…"></textarea>
    </div>

    <div class="submit-bar">
      <button class="btn btn-secondary" onclick="goHome()">&larr; Change Rotation</button>
      <button class="btn btn-primary" onclick="submitForm('${rotationName.replace(/'/g, "\\'")}')">Submit Evaluation</button>
    </div>
  `;
}

// ── Submit ───────────────────────────────────────────────────────────────────
async function submitForm(rotationName) {
  const resident = document.getElementById('field-resident').value;
  const evaluatorName = document.getElementById('field-evaluator-name').value.trim();
  const dateStart = document.getElementById('field-date-start').value;
  const narrative = document.getElementById('field-narrative').value.trim();

  if (!resident) { alert(`Please select a ${LEARNER}.`); return; }
  if (!evaluatorName) { alert('Please enter your name.'); return; }
  if (!dateStart) { alert('Please select a supervision date.'); return; }

  // undefined means "this rotation asks, and nothing was chosen"; null means
  // "this rotation does not ask".
  const rotationDetail = readRotationDetail(rotationName);
  if (rotationDetail === undefined) {
    alert('Please answer "' + rotationDetailFor(PROGRAM, rotationName).label + '"');
    return;
  }

  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dates = fmt(dateStart);

  const scores = {};
  let allAnswered = true;

  for (const epa of activeEpas(PROGRAM, rotationName)) {
    const checked = document.querySelector(`input[name="epa-${epa.id}"]:checked`);
    if (!checked) { allAnswered = false; break; }
    scores[epa.id] = checked.value === 'na' ? 'na' : parseInt(checked.value);
  }

  if (!allAnswered) { alert('Please answer all EPA questions before submitting.'); return; }
  if (!narrative) { alert('Please provide narrative comments.'); return; }

  const submission = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    resident,
    rotation: rotationName,
    evaluatorName,
    evaluatorId: null,   // filled in at save time once the roster row is resolved
    rotationDetail,
    rotationDetailId: null,   // filled in at save time once the list entry resolves
    dates,
    dateStart,
    dateEnd: dateStart,
    narrative,
    scores,
    milestoneScores: computeMilestoneScores(rotationName, scores),
    scoresDetail: buildScoresDetail(rotationName, scores),
    formVersion: formVersionFor(PROGRAM),
  };

  // Two things on this form are typed and must not fragment: the procedure or
  // subspecialty, and the evaluator. Each gets a near-miss check before it is
  // allowed to create a new entry, asked one after the other. Deliberately after
  // every other validation — prompting and then rejecting the form for a missing
  // narrative would be worse than either.
  await checkDetailThenEvaluator(submission, rotationName);
}

// Step 1 of 2: is this typed procedure/subspecialty a variant of one already on
// the list? Rotations that collect no detail fall straight through.
async function checkDetailThenEvaluator(submission, rotationName) {
  const cfg = rotationDetailFor(PROGRAM, rotationName);
  const typed = submission.rotationDetail;
  if (cfg && typed && !findDetailMatch(cfg.category, typed)) {
    const close = findCloseDetailMatch(cfg.category, typed);
    if (close) {
      pendingEvaluation = { submission, rotationName };
      detailDupCandidate = close;
      document.getElementById('detail-dup-typed').textContent = typed;
      document.getElementById('detail-dup-existing').textContent = close.name;
      document.getElementById('detail-dup-label').textContent =
        (cfg.category === 'procedure' ? 'procedure' : 'subspecialty');
      document.getElementById('detail-dup-modal').classList.add('open');
      return; // wait for resolveDetailDup()
    }
  }
  await checkEvaluatorThenSave(submission, rotationName);
}

let detailDupCandidate = null;

function resolveDetailDup(useExisting) {
  document.getElementById('detail-dup-modal').classList.remove('open');
  if (!pendingEvaluation) return;
  const { submission, rotationName } = pendingEvaluation;
  if (useExisting && detailDupCandidate) {
    submission.rotationDetail = detailDupCandidate.name;
    const field = document.getElementById('field-rotation-detail');
    if (field) field.value = detailDupCandidate.name;
  }
  pendingEvaluation = null;
  detailDupCandidate = null;
  checkEvaluatorThenSave(submission, rotationName);
}

// Step 2 of 2: is this typed evaluator a variant of someone already on the
// faculty roster?
async function checkEvaluatorThenSave(submission, rotationName) {
  const evaluatorName = submission.evaluatorName;
  if (!findFacultyMatch(evaluatorName)) {
    const close = findCloseMatch(evaluatorName);
    if (close) {
      pendingEvaluation = { submission, rotationName };
      evaluatorDupCandidate = close;
      document.getElementById('eval-dup-typed').textContent = evaluatorName;
      document.getElementById('eval-dup-existing').textContent = close.name;
      document.getElementById('eval-dup-modal').classList.add('open');
      return; // wait for resolveEvaluatorDup()
    }
  }
  await proceedWithEvaluation(submission, rotationName);
}

// Holds the finished evaluation while the "is this the same person?" prompt is
// open. The evaluation is complete at this point — only the name is in question.
let pendingEvaluation = null;
let evaluatorDupCandidate = null;

function resolveEvaluatorDup(useExisting) {
  document.getElementById('eval-dup-modal').classList.remove('open');
  if (!pendingEvaluation) return;
  const { submission, rotationName } = pendingEvaluation;

  if (useExisting && evaluatorDupCandidate) {
    submission.evaluatorName = evaluatorDupCandidate.name;
    const field = document.getElementById('field-evaluator-name');
    if (field) field.value = evaluatorDupCandidate.name;
  }

  pendingEvaluation = null;
  evaluatorDupCandidate = null;
  proceedWithEvaluation(submission, rotationName);
}

async function proceedWithEvaluation(submission, rotationName) {
  const submitBtn = document.querySelector('.btn-primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

  // Resolve the procedure/subspecialty to a list entry, adding it if genuinely
  // new so the next evaluator picks it instead of retyping a variant. Same
  // best-effort contract as the evaluator below: a list problem leaves the id
  // null and the evaluation keeps the typed text.
  const detailCfg = rotationDetailFor(PROGRAM, rotationName);
  if (detailCfg && submission.rotationDetail) {
    try {
      const opt = await registerDetailOption(detailCfg.category, submission.rotationDetail);
      if (opt && opt.id != null) {
        submission.rotationDetailId = opt.id;
        submission.rotationDetail = opt.name;   // store the list's spelling, not the typed one
      }
    } catch (e) {
      console.error('Could not resolve the rotation detail to a list entry:', e);
    }
  }

  // Resolve the evaluator to a roster row so the evaluation points at a person
  // and not just a spelling, creating the row if this name is genuinely new.
  // This has to happen BEFORE the save, because the id is part of what gets
  // saved — but it is still best-effort: any failure leaves evaluatorId null
  // and the evaluation is written with the name alone rather than lost.
  try {
    const record = await registerNewFaculty(submission.evaluatorName);
    if (record && record.id != null) submission.evaluatorId = record.id;
  } catch (e) {
    console.error('Could not resolve evaluator to a roster row:', e);
  }

  try {
    await saveSubmission(submission);
    showSuccess(submission.resident, rotationName);
  } catch (e) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Evaluation'; }
    alert('There was an error submitting. Please try again.');
  }
}

// Clears a stale "roster" hint as soon as the evaluator edits the field.
function onEvaluatorInput() { /* reserved for future inline feedback */ }

// ── Derived values stored alongside the raw scores ───────────────────────────
// Captures the wording and milestone mapping of each EPA as it stood at the
// moment of submission, so a historical evaluation always renders with the
// instrument the evaluator actually saw. Stored as an ARRAY, not an object:
// Postgres jsonb does not preserve object key order, and display order here
// is meaningful. Never reconstruct this from the current definitions.
function buildScoresDetail(rotationName, scores) {
  return activeEpas(PROGRAM, rotationName)
    .filter(epa => scores[epa.id] !== undefined)
    .map(epa => ({
      id:         epa.id,
      text:       epa.text,
      milestones: epa.milestones,
      score:      scores[epa.id],
    }));
}

// Averages each EPA's score into every milestone that EPA maps to. The codes
// are this program's codes: PROGRAM scopes activeEpas(), and saveSubmission()
// records which vocabulary they came from.
function computeMilestoneScores(rotationName, scores) {
  const milestoneAccum = {};

  for (const epa of activeEpas(PROGRAM, rotationName)) {
    const score = scores[epa.id];
    if (score === 'na' || score === undefined) continue;
    for (const m of epa.milestones) {
      if (!milestoneAccum[m]) milestoneAccum[m] = [];
      milestoneAccum[m].push(score);
    }
  }

  const milestoneScores = {};
  for (const [m, vals] of Object.entries(milestoneAccum)) {
    milestoneScores[m] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return milestoneScores;
}

// ── Storage (INSERT only — anon key) ─────────────────────────────────────────
async function saveSubmission(sub) {
  const payload = {
    resident:        sub.resident,
    rotation:        sub.rotation,
    program:         PROGRAM,
    evaluator_name:  sub.evaluatorName,
    evaluator_id:    sub.evaluatorId ?? null,
    rotation_detail:    sub.rotationDetail ?? null,
    rotation_detail_id: sub.rotationDetailId ?? null,
    date_start:      sub.dateStart || '',
    date_end:        sub.dateStart || '',
    scores:          sub.scores,
    milestone_scores: sub.milestoneScores,
    scores_detail:   sub.scoresDetail,
    form_version:    sub.formVersion,
    narrative:       sub.narrative,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/epa_submissions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Submission failed: ${response.status} ${err}`);
  }
  return { status: 'success' };
}

// ── Success screen ───────────────────────────────────────────────────────────
function showSuccess(resident, rotation) {
  const el = document.getElementById('form-content');
  el.innerHTML = `
    <div class="success-screen">
      <div class="success-icon">✓</div>
      <h2>Evaluation <strong>Submitted</strong></h2>
      <p>Your evaluation of <strong>${resident}</strong> for the <strong>${rotation}</strong> rotation has been recorded. Please remember to also provide verbal feedback directly to the ${LEARNER}.</p>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap">
        <button class="btn btn-primary" onclick="goHome()">Submit Another</button>
      </div>
    </div>
  `;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  renderFormLanding();
  // All three rosters in parallel. None blocks the others, and a failure in any
  // leaves a visible placeholder rather than an empty picker.
  await Promise.all([loadResidents(), loadFaculty(), loadDetailOptions()]);
  renderFormLanding(); // re-render once the rosters are in
}

init();
