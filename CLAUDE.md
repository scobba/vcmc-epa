# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A set of medical-education survey and dashboard apps for the VCMC Family Medicine Residency Program, served as a static site from GitHub Pages at `eval.venturafamilymed.org` (see `CNAME`).

There is no build system, no package manager, no test suite, and no dependencies to install. **Every page is a single self-contained `index.html`** with all CSS in one `<style>` block and all JS in one `<script>` block at the bottom. Deployment is `git push` to `main`; the live URL updates directly.

To preview locally, open the file in a browser, or serve the repo root so the clean URLs resolve:

```bash
python -m http.server 8000
```

Note that live data reads/writes still hit the production Supabase projects from a local page — there is no staging backend.

## Backend: two separate Supabase projects

Everything talks to Supabase directly over PostgREST from the browser. The anon key is embedded in each page by design; access control lives in Supabase Row Level Security policies, which are **not** in this repo.

| Project | Used by | Tables |
| --- | --- | --- |
| `ubqecdyhgejqoweltagl` | root, `faculty/`, `faculty-dashboard/`, `resident-dashboard/` | `epa_submissions`, `faculty_submissions`, `residents`, `faculty` |
| `zwfbppgkodhlpgsxcdry` | `camphope/*` | `camp_hope_responses` |

Forms POST anonymously with the anon key (`Prefer: return=minimal`). Dashboards sit behind a Supabase Auth email/password gate and send the **session access token** instead of the anon key — RLS is expected to block anon reads. Dashboard accounts are created manually in the Supabase console; there is no signup flow. Dashboards also carry `<meta name="robots" content="noindex, nofollow">`.

Two auth implementations exist for the same thing: `faculty-dashboard/` and `resident-dashboard/` load the `@supabase/supabase-js@2` CDN bundle and use `supabaseClient.auth`, while `camphope/dashboard/` hits `/auth/v1/token` with plain `fetch` and stores the token in `sessionStorage`. Match whichever file you are editing.

### What may go in `sql/`

Schema changes are recorded as numbered files in `sql/` and applied by hand in the Supabase SQL editor — there is no migration runner, and nothing applies them automatically on deploy.

**Apply the migration before pushing the page that needs it.** The form POSTs every column it knows about in one payload, so a page deployed ahead of its migration makes PostgREST reject the entire insert (`42703`) and every evaluation fails with an error the evaluator cannot work around. Run the SQL, confirm the column resolves, then push. A quick anonymous probe distinguishes the two states without needing credentials — `42703 column … does not exist` means the migration has not run, while `42501 permission denied for table` means the column exists and RLS is doing its job:

```
curl -s "$SUPABASE_URL/rest/v1/epa_submissions?select=<column>&limit=1" -H "apikey: <anon key>"
```

**This repo is public, and it is also the published website.** Every file in it is readable both at `github.com/scobba/vcmc-epa` and at `eval.venturafamilymed.org/<path>`, and git history is permanent — committing something and deleting it later does not unpublish it. So:

- Migrations in `sql/` may contain **schema only**: `alter table`, `create index`, `comment on`, grants.
- Never commit resident names, evaluation content, narrative text, or any other identifiable data. A migration that fixes a mis-entered evaluation or merges duplicate residents *will* contain real names — that one gets run in the Supabase SQL editor, and only a numbered file describing what was run and when gets committed.
- Never commit full RLS policy bodies. Recording that a policy changed is fine; publishing the `using (…)` expression hands out the authorization logic for free.
- Never commit connection strings, personal access tokens, or the service-role key. The anon keys already embedded in the pages are public by design; nothing else is.

## The three app families

**EPA resident evaluation** — [index.html](index.html) is the form; [resident-dashboard/index.html](resident-dashboard/index.html) is the analytics view. Faculty pick a rotation, a resident (roster fetched live from `residents`), then score each EPA on a 0–5 entrustment scale (plus `na`). The form computes `milestone_scores` client-side in `computeMilestoneScores()` by averaging each EPA's score into every ACGME milestone that EPA maps to, and stores both the raw `scores` and the derived `milestone_scores` JSON on the row. The dashboard re-reads those precomputed milestone averages rather than recomputing from raw scores.

Each submission also carries `scores_detail` (see [sql/001_add_scores_detail.sql](sql/001_add_scores_detail.sql)) — an ordered array of `{ id, text, milestones, score }` built by `buildScoresDetail()` that freezes the EPA wording and milestone mapping **as they stood at submission time**. This is what makes the evaluation record survive edits to `ROTATIONS`. Two rules follow from it:

- Never rewrite `scores_detail` on existing rows, and never "backfill" it from the current definitions — a reconstructed snapshot is a fabricated record of what the evaluator saw.
- The dashboard resolves EPA labels through `epaRows()`, which prefers the stored snapshot, falls back to current `ROTATIONS` for pre-migration rows, and renders any orphaned score under its raw id rather than dropping it. Render EPA text through that helper, never from `ROTATIONS` directly.

Renaming an EPA id still breaks the *fallback* path for pre-migration rows, so ids are append-only — and there is a mechanism for that. Mark an EPA `retired: true` and `activeEpas()` drops it from the form, from `buildScoresDetail()`, and from `computeMilestoneScores()`, while its definition stays in `ROTATIONS` to resolve labels for older rows. Never delete an EPA entry and never reuse an id; keep retired entries in **both** copies of `ROTATIONS`, since the dashboard mirror is what resolves the label.

Every submission is also stamped with `form_version` (see [sql/002_add_form_version.sql](sql/002_add_form_version.sql)) from the `FORM_VERSION` constant near the top of [index.html](index.html). Bump it whenever the measurement changes — an EPA reworded, added, or retired, or a milestone mapping altered — so a cohort of evaluations can be identified without inspecting every row. `NULL` means the row predates versioning; never backfill it.

**Faculty evaluation** — [faculty/index.html](faculty/index.html) is the anonymous form (10 fixed `QUESTIONS`, 1–7 agreement scale + `na`, plus a 1–5 overall); [faculty-dashboard/index.html](faculty-dashboard/index.html) aggregates it. The form does fuzzy duplicate detection on typed faculty names via Damerau–Levenshtein (`findCloseMatch`) and, on successful submit, self-registers genuinely new names into the `faculty` table (`registerNewFaculty`) so the roster grows without admin action. That write is best-effort and must never block a submission.

Each rating is stored as `{ item, rating }` with the question wording attached, and the dashboard reads it that way: `itemAveragesFor()` matches on that stored text, and `questionIndex()` builds the column order from the current `QUESTIONS` plus any wording found in the data that is no longer there. Aggregate ratings by stored text, never by array position — indexing into `s.ratings[i]` silently attributes old answers to whichever question now occupies that slot, which is what inserting or reordering an item used to do. Retired wording keeps its responses and sorts to the end.

**Camp HOPE surveys** — [camphope/index.html](camphope/index.html) (clinical team) and [camphope/partner/index.html](camphope/partner/index.html) (Family Justice Center partners) are two copies of the *same* survey engine differing only in the `SURVEY` object; [camphope/dashboard/index.html](camphope/dashboard/index.html) reads both. Item types are `single`, `multi`, `short`, `long`, `likert`, and `note`, with conditional display via `showIf` (either `{ q, in: [...] }` or `{ role }`, where role is derived from the q1 answer by `roleGroup()`). Both surveys write to the same `camp_hope_responses` table, discriminated by `survey` (`clinical_team` / `partner_fjc`) and `camp_year`.

## The duplication that will bite you

These pages share no code. Data definitions are copy-pasted across files and drift silently:

- `ROTATIONS` (11 rotations, 71 EPAs) exists in both [index.html](index.html) and [resident-dashboard/index.html](resident-dashboard/index.html). The dashboard copy is a deliberately trimmed mirror — same rotation names, same EPA `id`s, same `milestones`, but **no `context` field**. Milestone `id`s must also stay aligned with `MILESTONE_DEFS`.
- `QUESTIONS` is duplicated between [faculty/index.html](faculty/index.html) and [faculty-dashboard/index.html](faculty-dashboard/index.html), but the dashboard no longer treats its copy as the source of identity — see the faculty section above. The form's copy decides what is asked; the text stored on each rating decides how it is counted. Keeping the copies in sync is now a tidiness concern, not a correctness one.
- The camphope survey engine (`render`, `visible`, `isAnswered`, `buildResponses`, `submitForm`) is duplicated between the two form files. Fix a bug in one, fix it in the other.
- The `:root` design-token block (navy/gold/slate palette, VCMC header, footer) is duplicated in all seven pages. Scale color tokens differ intentionally: `--scale-1..5` for the 0–5 EPA scale, `--scale-1..7` for the 1–7 faculty scale, `--adq-1..5` for camphope.

The camphope dashboard is the exception — it does **not** duplicate the survey definitions. Each stored response record is self-describing (`{ num, question, answer }`, or `{ num, question, scale, statements }` for likert), and `questionIndex()` reconstructs the questionnaire and infers each question's kind from the submitted rows. Preserve that self-describing shape in `buildResponses()` or the dashboard loses its labels.

## Conventions

- Rendering is `innerHTML` from template literals with an `esc()` helper on untrusted text; state lives in module-level `let` variables (`answers`, `ratings`, `allSubmissions`, `RAW`) and a full `render()` redraw on change.
- Rotation and question data is authored inline as JS object literals near the top of the `<script>` block, after the Supabase config.
- Dashboards offer client-side CSV export (`exportCSV`) and `window.print()` with print stylesheets — no server-side reporting.
- Column names are snake_case in payloads and camelCase after the load-time mapping in `loadSubmissions()`; keep that boundary in one place.
- Commits are single-file page edits; keep changes scoped to the page you are asked about rather than propagating a refactor across all seven.
