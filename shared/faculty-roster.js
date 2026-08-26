// ─────────────────────────────────────────────────────────────────────────────
// shared/faculty-roster.js
//
// The faculty roster and the name-matching that keeps it from filling up with
// spelling variants of the same person. Used by two pages that both ask a human
// to type a faculty name:
//
//   faculty/          - "Attending Name" (who is being evaluated)
//   index.html        - "Evaluator Name" (who is doing the evaluating)
//
// Both read the same `faculty` table in project ubqecdyhgejqoweltagl, and both
// let a genuinely new name self-register so the roster grows without an admin.
// That is only safe because a typed name is checked against the roster twice:
// exactly (findFacultyMatch) and then approximately (findCloseMatch), so
// "Tipu Kahn" is offered the existing "Tipu Khan" instead of quietly becoming
// a second person.
//
// CONTRACT
//   The loading page must define SUPABASE_URL and SUPABASE_ANON before any of
//   these functions are CALLED. Loading this file first is fine; nothing here
//   touches them at load time.
//
//   registerNewFaculty is best-effort by design. A roster write must never
//   block an evaluation from being submitted - the evaluation is the record
//   that matters, the roster is a convenience.
// ─────────────────────────────────────────────────────────────────────────────

// Faculty roster loaded dynamically from Supabase `faculty` table
let FACULTY = [];          // [{id, name, department}]
let facultyLoaded = false;

async function loadFaculty() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/faculty?select=id,name,department&active=eq.true&order=sort_order.asc,name.asc`,
      { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` } }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    FACULTY = rows.filter(r => r.name && r.name.trim());
    if (FACULTY.length === 0) FACULTY = [{ name: '[No faculty found — check Supabase faculty table]', department: '' }];
  } catch (e) {
    console.error('Failed to load faculty:', e);
    FACULTY = [{ name: '[Could not load faculty — check Supabase connection]', department: '' }];
  }
  facultyLoaded = true;
}

function normalize(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function findFacultyMatch(name) {
  const n = normalize(name);
  if (!n) return null;
  return FACULTY.find(f => normalize(f.name) === n) || null;
}

// Simple edit-distance check — catches typo/spelling variants of an
// existing name (e.g. "Tipu Kahn" vs. the roster's "Tipu Khan") that
// findFacultyMatch's exact-normalized comparison would miss, so the
// resident gets asked before a near-duplicate is created. Damerau-
// Levenshtein (rather than plain Levenshtein) counts an adjacent-letter
// swap as a single edit, which is exactly the "Kahn"/"Khan" case.
function damerauLevenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function findCloseMatch(name) {
  const target = normalize(name);
  if (!target || target.length < 3) return null;
  let best = null, bestDist = Infinity;
  FACULTY.forEach(f => {
    if (f.name.startsWith('[')) return; // skip "could not load" placeholders
    const candidate = normalize(f.name);
    if (candidate === target) return; // exact matches are handled elsewhere
    const dist = damerauLevenshtein(target, candidate);
    const threshold = Math.max(1, Math.floor(Math.max(target.length, candidate.length) * 0.2));
    if (dist <= threshold && dist < bestDist) { best = f; bestDist = dist; }
  });
  return best;
}

function departmentOptions() {
  const depts = [...new Set(FACULTY.map(f => f.department).filter(d => d && d.trim()))].sort();
  return depts;
}

// Resolves a typed name to a roster record, creating one if the name is new, so
// a caller can store `id` rather than only a spelling. Returns {id, name,
// department}, or null when no id could be established — the caller then stores
// the name alone rather than failing.
//
// Best-effort by contract: every failure path returns null and logs. A roster
// problem must never cost an evaluation.
//
// `department` is optional. The EPA form asks who evaluated a resident but not
// what department they sit in, so it passes nothing and the roster row is
// created with a null department for someone to fill in later.
async function registerNewFaculty(name, department) {
  // If the roster never loaded, we cannot tell whether this person is already on
  // it — findFacultyMatch would report "new" for everyone and every submission
  // would append a duplicate of someone who was already there. Silence is the
  // safe answer: the evaluation is saved either way, and the roster is only a
  // convenience.
  if (!facultyLoaded || realFaculty().length === 0) return null;

  const existing = findFacultyMatch(name);
  if (existing) return existing; // already on the roster — hand back its id

  const dept = (!department || department === 'Unknown') ? null : department;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        // representation, not minimal: the caller needs the generated id so the
        // evaluation can point at the roster row rather than only at a spelling.
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({
        name: name.trim(),
        department: dept,
        active: true,
        sort_order: 0,
      }),
    });
    if (!response.ok) {
      console.error('Could not register new faculty:', await response.text());
      return null;
    }
    // The row was created either way. If the body cannot be read back the
    // registration still counted — only the id is unavailable, and a caller
    // that gets null simply stores no id.
    let created = null;
    try {
      const rows = await response.json();
      created = Array.isArray(rows) ? rows[0] : rows;
    } catch (e) { /* created but unreadable */ }

    const record = { id: created ? created.id : undefined, name: name.trim(), department: dept };
    FACULTY.push(record);
    return record.id == null ? null : record;
  } catch (e) {
    console.error('Could not register new faculty:', e);
    return null;
  }
}

// Faculty names reach the roster through anonymous self-registration, so by the
// time they are rendered back into a page they are untrusted input. Escape
// before interpolating into markup.
function escFaculty(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Real roster entries, excluding the "[Could not load...]" placeholders that
// loadFaculty() substitutes when the fetch fails.
function realFaculty() {
  return FACULTY.filter(function (f) { return f.name && !f.name.startsWith('['); });
}

// <datalist> options for the roster. Both pages render the same list, so the
// escaping lives here once and cannot drift between them.
function facultyDatalistOptions() {
  return realFaculty().map(function (f) {
    return '<option value="' + escFaculty(f.name) + '">';
  }).join('');
}

// The small line under the name box telling the user whether the roster arrived.
function facultyRosterStatus() {
  return facultyLoaded
    ? '<div class="roster-status">' + realFaculty().length + ' faculty loaded</div>'
    : '<div class="roster-status">Loading faculty roster&hellip;</div>';
}
