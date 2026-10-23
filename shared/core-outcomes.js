// ─────────────────────────────────────────────────────────────────────────────
// shared/core-outcomes.js
//
// How a learner's evaluations are judged against an ABFM core outcome. The
// crosswalk and the rule are data in definitions.js (coreOutcomesFor(),
// coreOutcomeRuleFor()); this is the arithmetic that applies them.
//
// Shared so that the program dashboard's Core Outcomes tab and the mapping
// check (mapping-check/) run the SAME code. A check that ran a copy would only
// prove the copy works. Pure functions: no network, no DOM. The two things that
// differ between the pages are passed in:
//
//   rowsOf(sub)  -> [{ id, text, score }]  the EPAs an evaluation scored
//                   (the dashboard passes epaRows, which falls back to the
//                   definitions for rows older than scores_detail)
//   raterOf(sub) -> a person                the attending, resolved so that two
//                   spellings of one attending count as one rater (the
//                   dashboard passes displayEvaluatorName)
//
// Loaded after definitions.js.
// ─────────────────────────────────────────────────────────────────────────────

// Every numeric score in these evaluations, by EPA id. N/A is not a score.
function coScoresByEpa(subs, rowsOf) {
  const byEpa = new Map();
  subs.forEach(sub => rowsOf(sub).forEach(r => {
    if (r.id == null || r.score === 'na' || r.score == null) return;
    const value = Number(r.score);
    if (!Number.isFinite(value)) return;
    if (!byEpa.has(r.id)) byEpa.set(r.id, []);
    byEpa.get(r.id).push({ value, sub, epaId: r.id, text: r.text });
  }));
  return byEpa;
}

// Newest first: by supervision date, then by when it was filed.
const coWhen = sub => (sub.dateStart || '') + '|' + (sub.timestamp || '');

// One outcome, its EPAs pooled. An evaluation is evidence only if it scored at
// least one of them - an evaluation where they were all N/A observed none of
// it. The window is the `rule.recentEvals` most recent such evaluations; every
// score they gave the outcome's EPAs is averaged together, and the exact
// average decides - compared unrounded, so 3.47 is short of 3.5.
function coOutcome(outcome, byEpa, rule, raterOf) {
  const partOf = new Map();                       // EPA id -> the first part listing it
  outcome.parts.forEach(p => p.epas.forEach(id => { if (!partOf.has(id)) partOf.set(id, p); }));

  const bySub = new Map();
  [...partOf.keys()].forEach(id => (byEpa.get(id) || []).forEach(e => {
    if (!bySub.has(e.sub.id)) bySub.set(e.sub.id, { sub: e.sub, scores: [] });
    bySub.get(e.sub.id).scores.push(e);
  }));
  const onFile  = [...bySub.values()].sort((a, b) => coWhen(b.sub).localeCompare(coWhen(a.sub)));
  const win     = onFile.slice(0, rule.recentEvals);
  const counted = win.flatMap(w => w.scores);
  const raters  = new Set(win.map(w => raterOf(w.sub))).size;
  const avg     = counted.length ? counted.reduce((s, e) => s + e.value, 0) / counted.length : null;
  const state = !partOf.size ? 'unmeasured'
    : (win.length < rule.minEvals || raters < rule.minRaters) ? 'insufficient'
    : avg >= rule.threshold ? 'met' : 'progressing';

  // Which areas the evidence covers: scores per part inside the counted
  // evaluations, and on file at all. Parts are not judged separately (since
  // 2026-10-22) - this is what lets the CCC see an area with no evidence.
  const allScores = onFile.flatMap(w => w.scores);
  const parts = outcome.parts.map(p => ({
    part:     p,
    inWindow: counted.filter(e => partOf.get(e.epaId) === p).length,
    onFile:   allScores.filter(e => partOf.get(e.epaId) === p).length,
  }));

  return { outcome, win, counted, evals: win.length, older: onFile.length - win.length,
           raters, avg, state, parts, partOf };
}
