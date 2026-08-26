// ─────────────────────────────────────────────────────────────────────────────
// shared/text-matching.js
//
// Two pure string functions used wherever a human types a name that ought to
// match something already on file — faculty on both evaluation forms, and the
// procedure / subspecialty list on the EPA form.
//
// They exist in their own file because two roster modules need them and neither
// should have to load the other to get them.
//
// These decide SIMILARITY, never IDENTITY. A close match is something to offer
// a person, never something to merge on. Every caller in this codebase uses
// exact matching to decide what a record means and reserves fuzzy matching for
// asking a human first.
// ─────────────────────────────────────────────────────────────────────────────

// Casefold and strip punctuation so "Dr. Jane Smith, PA-C" and "dr jane smith pa c"
// compare equal. Used for exact-match lookups, not just fuzzy ones.
function normalize(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

