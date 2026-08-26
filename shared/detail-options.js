// ─────────────────────────────────────────────────────────────────────────────
// shared/detail-options.js
//
// The pickable values behind epa_submissions.rotation_detail: which procedure,
// which subspecialty. Structurally identical to shared/faculty-roster.js and for
// the same reason — a list people type into drifts unless typed values are fed
// back into it and near-misses are caught before a second spelling is created.
//
// Two categories, from ROTATION_DETAIL in shared/definitions.js:
//   'procedure'     Procedural Care
//   'subspecialty'  both Subspecialty rotations, sharing one list
//
// CONTRACT
//   Requires shared/text-matching.js (normalize, damerauLevenshtein) and
//   SUPABASE_URL / SUPABASE_ANON defined by the loading page before any of these
//   functions are CALLED. Nothing here touches them at load time.
//
//   registerDetailOption is best-effort: every failure path returns null and the
//   evaluation is saved with the typed text and no id. A list problem must never
//   cost an evaluation.
// ─────────────────────────────────────────────────────────────────────────────

let DETAIL_OPTIONS = [];        // [{id, category, name, active, merged_into}]
let detailOptionsLoaded = false;

async function loadDetailOptions() {
  try {
    const res = await fetch(
      // Every row, including merged and inactive ones: a dashboard must be able
      // to resolve an id or a value that is no longer offered on the form.
      `${SUPABASE_URL}/rest/v1/detail_options?select=id,category,name,active,merged_into&order=sort_order.asc,name.asc`,
      { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DETAIL_OPTIONS = await res.json();
  } catch (e) {
    console.error('Failed to load detail options:', e);
    DETAIL_OPTIONS = [];
  }
  detailOptionsLoaded = true;
}

// Everything in a category, for resolving. Includes merged and inactive rows.
function allDetailOptions(category) {
  return DETAIL_OPTIONS.filter(o => o.category === category);
}

// What a person may actually choose: not merged into something else, not retired.
function pickableDetailOptions(category) {
  return allDetailOptions(category).filter(
    o => o.active !== false && (o.merged_into === null || o.merged_into === undefined));
}

function detailOptionById(id) {
  if (id === null || id === undefined) return null;
  return DETAIL_OPTIONS.find(o => String(o.id) === String(id)) || null;
}

// Exact match within a category, ignoring case and punctuation.
function findDetailMatch(category, name) {
  const n = normalize(name);
  if (!n) return null;
  return allDetailOptions(category).find(o => normalize(o.name) === n) || null;
}

// Near-miss, for asking a person before a second spelling is created. Suggests
// only pickable options — offering a merged alias back would rebuild the
// duplicate a reviewer just resolved.
function findCloseDetailMatch(category, name) {
  const target = normalize(name);
  if (!target || target.length < 3) return null;
  let best = null, bestDist = Infinity;
  pickableDetailOptions(category).forEach(o => {
    const cand = normalize(o.name);
    if (cand === target) return;
    const dist = damerauLevenshtein(target, cand);
    const threshold = Math.max(1, Math.floor(Math.max(target.length, cand.length) * 0.2));
    if (dist <= threshold && dist < bestDist) { best = o; bestDist = dist; }
  });
  return best;
}

// Follows a merge chain to the option that actually represents this thing.
// Cycle- and depth-guarded, so a hand-edited merge cannot hang a page.
function canonicalDetailOption(row) {
  let cur = row, hops = 0;
  const seen = {};
  while (cur && cur.merged_into !== null && cur.merged_into !== undefined && hops < 20) {
    if (seen[cur.id]) break;
    seen[cur.id] = true;
    const next = detailOptionById(cur.merged_into);
    if (!next) break;
    cur = next; hops++;
  }
  return cur || null;
}

// The identity a submission's detail should be counted under. Prefers the id
// captured at submission, falls back to an exact match on the stored text for
// rows written before ids existed, and returns null when neither resolves — the
// caller then groups by the raw text rather than dropping the row.
function resolveDetailIdentity(category, id, text) {
  let row = detailOptionById(id);
  if (!row && text) row = findDetailMatch(category, text);
  if (!row) return null;
  const canon = canonicalDetailOption(row);
  return canon ? { id: canon.id, name: canon.name, category: canon.category } : null;
}

// Resolves a typed value to an option, creating it if the value is genuinely
// new, so the next person picks it instead of retyping a variant. Returns
// {id, name, category} or null when no id could be established.
async function registerDetailOption(category, name) {
  const clean = (name || '').trim();
  if (!clean) return null;

  // If the list never loaded we cannot tell new from unseen, and guessing wrong
  // permanently adds a duplicate. Do nothing; the evaluation still saves.
  if (!detailOptionsLoaded || allDetailOptions(category).length === 0) return null;

  const existing = findDetailMatch(category, clean);
  if (existing) return canonicalDetailOption(existing) || existing;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/detail_options`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({ category: category, name: clean, active: true, sort_order: 0 }),
    });
    if (!res.ok) {
      console.error('Could not add detail option:', await res.text());
      return null;
    }
    let created = null;
    try {
      const rows = await res.json();
      created = Array.isArray(rows) ? rows[0] : rows;
    } catch (e) { /* created but unreadable */ }
    if (!created || created.id == null) return null;

    const record = { id: created.id, category: category, name: clean, active: true, merged_into: null };
    DETAIL_OPTIONS.push(record);
    return { id: record.id, name: record.name, category: category };
  } catch (e) {
    console.error('Could not add detail option:', e);
    return null;
  }
}

// <datalist> options for a category. Escaping via escFaculty(), which lives in
// faculty-roster.js — these values are typed by evaluators and are untrusted by
// the time they are drawn back into a page.
function detailDatalistOptions(category) {
  return pickableDetailOptions(category)
    .map(o => '<option value="' + escFaculty(o.name) + '">').join('');
}
