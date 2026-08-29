# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A set of medical-education survey and dashboard apps for the VCMC Family Medicine Residency Program, served as a static site from GitHub Pages at `eval.venturafamilymed.org` (see `CNAME`).

There is no build system, no package manager, no test suite, and no dependencies to install. **Most pages are a single self-contained `index.html`** with all CSS in one `<style>` block and all JS in one `<script>` block at the bottom. The two EPA *forms* are the exception: they share their engine (see [shared/epa-form.js](shared/epa-form.js)) and each page is CSS plus markup plus a short configuration block. Deployment is `git push` to `main`; the live URL updates directly.

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

### Backups

Supabase holds the only copy of every submission. [tools/backup-supabase.ps1](tools/backup-supabase.ps1) writes a JSON snapshot of all five tables across both projects; see [tools/README.md](tools/README.md) for setup. It reads service-role keys from environment variables and writes outside the repo — snapshots contain resident names and narrative evaluations and must never land in this folder.

Prefer that script over the dashboards' CSV export when the goal is preservation: CSV flattens `scores`, `milestone_scores`, and `scores_detail` into text and cannot be loaded back.

## The three app families

**EPA learner evaluation** — two forms sharing one engine: [index.html](index.html) evaluates Family Medicine residents and [fellowship/index.html](fellowship/index.html) evaluates Addiction Medicine fellows. [resident-dashboard/index.html](resident-dashboard/index.html) is the analytics view. Faculty pick a rotation, a learner (roster fetched live from `residents`, filtered by program), identify themselves from the `faculty` roster, then score each EPA on a 0–5 entrustment scale (plus `na`).

**The form engine lives in [shared/epa-form.js](shared/epa-form.js), not in the pages.** Each form page is a `<style>` block, the markup shell, and a configuration script that defines `SUPABASE_URL`, `SUPABASE_ANON` and `PROGRAM` — then loads the engine. Everything else is shared. Do not add form logic to a page; add it to the engine, where both programs get it.

[fellowship/epa-review/index.html](fellowship/epa-review/index.html) is a **generated snapshot**, not a source of truth — a read-only page circulating the fellowship's draft EPAs for faculty review, with a milestone coverage grid and the ACGME reference table. Its EPA data is a verbatim copy of `ROTATIONS_AM` and `MILESTONE_DEFS_AM` lifted out of [shared/definitions.js](shared/definitions.js) at the moment it was built. **It does not update itself.** Edit the EPAs and this page silently disagrees with the form, which is worse than having no page at all — so regenerate it from the definitions rather than hand-editing the copy, and move its footer date. It carries `noindex, nofollow` while the EPAs are a draft.

The engine reads `PROGRAM` as a global and uses it for every program-scoped call — `activeEpas()`, `buildScoresDetail()`, `computeMilestoneScores()`, `rotationDetailFor()` — and stamps it on the row in `saveSubmission()`. The word "resident" or "fellow" on screen comes from `PROGRAMS[PROGRAM].learner`, so the two pages cannot disagree about what a learner is called. A page that loads the engine without defining `PROGRAM` throws immediately rather than half-rendering.

A form page's markup must provide `#view-landing`, `#view-form`, `#form-content-landing`, `#form-content`, `#nav-form-btn`, the `.nav-btn` buttons, and both near-miss modals (`#detail-dup-modal`, `#eval-dup-modal`) with the ids their handlers read. The detail modal stays in the markup even for a program whose rotations collect no detail — the engine looks those ids up unconditionally.

The evaluator field is a datalist picker backed by [shared/faculty-roster.js](shared/faculty-roster.js), the same module the faculty form uses — a typed name is checked exactly (`findFacultyMatch`) then approximately (`findCloseMatch`), and a near-miss prompts before it self-registers, so one attending does not become three spellings across three evaluations.

Each row stores **both** `evaluator_name` and `evaluator_id` (see [sql/005_add_evaluator_id.sql](sql/005_add_evaluator_id.sql)) — the name is what the evaluator typed and remains the historical record; the id points at the `faculty` row and is how identity should be resolved going forward. Same split as `scores_detail`: keep what was seen *and* what it meant. `registerNewFaculty()` returns the roster record so the id can be resolved before the save; every failure path returns `null` and the evaluation is written with the name alone rather than lost. `NULL` means "identified by name only" — never backfill it by matching names, since a name that matches today may be a different person.

Below that table, **evaluator names the roster cannot resolve** are listed for reconciliation. "Add as a new person" creates a roster row with that exact name; "Same as …" creates the row and immediately merges it into the chosen person, leaving the typed spelling on the roster as a hidden alias — that alias is what lets an old evaluation find its author. Both go through `registerNewFaculty()` (an anon-permitted insert) plus the `merged_into` PATCH, so no new permissions were needed, and both are undoable from the faculty dashboard's Roster tab. Submissions are never modified.

The dashboard's **By Evaluator** tab groups evaluations by the person who wrote them, resolving through the faculty roster via `displayEvaluatorName()` → `resolveFacultyIdentity()`, so a merged duplicate collapses and an evaluator the roster does not know still appears under the typed name (flagged "not on roster"). The "vs. All" column is a rater-tendency signal, not a measure of accuracy — it is confounded by case mix and volume, and the view says so on screen.

The form computes `milestone_scores` client-side in `computeMilestoneScores()` by averaging each EPA's score into every ACGME milestone that EPA maps to, and stores both the raw `scores` and the derived `milestone_scores` JSON on the row. The dashboard re-reads those precomputed milestone averages rather than recomputing from raw scores.

Milestone scores are **reported in half-steps** via `halfStep()` in [resident-dashboard/index.html](resident-dashboard/index.html) — the 0–5 entrustment scale is ordinal, so "2.24" implies precision the instrument does not have. The rounding happens only at the point of display: `milestone_scores` stays raw in the database, so an aggregate is averaged from full precision and rounded once at the end. Order matters — three evaluations at 2.2, 2.2 and 2.4 report 2.5 when rounded last, but 2.0 if each is rounded first. Never round into a stored value or into an accumulator. EPA average scores are a separate figure and stay at two decimals.

Each submission also carries `scores_detail` (see [sql/001_add_scores_detail.sql](sql/001_add_scores_detail.sql)) — an ordered array of `{ id, text, milestones, score }` built by `buildScoresDetail()` that freezes the EPA wording and milestone mapping **as they stood at submission time**. This is what makes the evaluation record survive edits to the program's `ROTATIONS_*` set. Two rules follow from it:

- Never rewrite `scores_detail` on existing rows, and never "backfill" it from the current definitions — a reconstructed snapshot is a fabricated record of what the evaluator saw.
- The dashboard resolves EPA labels through `epaRows()`, which prefers the stored snapshot, falls back to `epaDefsFor(sub.program, sub.rotation)` for pre-migration rows, and renders any orphaned score under its raw id rather than dropping it. Render EPA text through that helper, never from a `ROTATIONS_*` object directly.

Three rotations describe a shape of encounter rather than a subject — Procedural Care and the two Subspecialty rotations — so they ask one extra question, driven by `ROTATION_DETAIL_BY_PROGRAM` in [shared/definitions.js](shared/definitions.js) and stored in `rotation_detail` (see [sql/008_add_rotation_detail.sql](sql/008_add_rotation_detail.sql)). It is a **live, self-growing list**, not free text: values live in the `detail_options` table, loaded by [shared/detail-options.js](shared/detail-options.js), which is a structural mirror of the faculty roster — type-ahead over what exists, a near-miss prompt before a second spelling is created, self-registration of genuinely new values, and reviewer merges resolved at read time. Both Subspecialty rotations share one `subspecialty` category. Each row stores `rotation_detail` (the text) and `rotation_detail_id`, the same split as `evaluator_name`/`evaluator_id`. A rotation absent from its program's entry shows no field and stores `NULL`.

`normalize()` and `damerauLevenshtein()` live in [shared/text-matching.js](shared/text-matching.js) because both roster modules need them; load it before either. The dashboard's **Procedures** tab counts one evaluation as one procedure, which holds because the Procedural Care EPAs are written about "the procedure" in the singular — a resident doing several under one evaluation is undercounted, and a quantity column would be the fix. Rows predating the field are reported as "unlabelled" rather than dropped.

Renaming an EPA id still breaks the *fallback* path for pre-migration rows, so ids are append-only — and there is a mechanism for that. Mark an EPA `retired: true` and `activeEpas(program, rotation)` drops it from the form, from `buildScoresDetail()`, and from `computeMilestoneScores()`, while its definition stays in that program's `ROTATIONS_*` set to resolve labels for older rows. Never delete an EPA entry and never reuse an id; retired entries are what `epaDefsFor()` returns to resolve an old row's label.

Every submission is also stamped with `form_version` (see [sql/002_add_form_version.sql](sql/002_add_form_version.sql)) from that program's `formVersion` in `PROGRAMS` (see [shared/definitions.js](shared/definitions.js)). Bump the program's own value whenever the measurement changes — an EPA reworded, added, or retired, or a milestone mapping altered — so a cohort of evaluations can be identified without inspecting every row. `NULL` means the row predates versioning; never backfill it.

**Faculty evaluation** — [faculty/index.html](faculty/index.html) is the anonymous form (10 fixed `QUESTIONS`, 1–7 agreement scale + `na`, plus a 1–5 overall); [faculty-dashboard/index.html](faculty-dashboard/index.html) aggregates it. **Identity resolution.** One person can be on the roster twice (the old free-text fields allowed it). `faculty.merged_into` records a reviewer's decision that two rows are the same person, and everything resolves it at read time through `resolveFacultyIdentity(id, name)` — prefer the stored id, else an **exact** name match, else fall back to the typed name. `canonicalFaculty()` follows merge chains and is guarded against cycles. Never resolve identity by fuzzy matching: `findCloseMatch` is for suggesting to a human, never for deciding. Pickers offer `pickableFaculty()` (not merged, not inactive) while `realFaculty()` keeps everything so old rows stay resolvable. Merges are made in the faculty dashboard's **Roster** tab, are reversible, and never modify a submission row — [sql/007_add_faculty_merged_into.sql](sql/007_add_faculty_merged_into.sql).

Roster loading, name matching and self-registration live in [shared/faculty-roster.js](shared/faculty-roster.js), used by this form and the EPA form. A typed name is matched exactly, then by Damerau–Levenshtein (`findCloseMatch`), and a near-miss is offered to the user before a second spelling is created. `registerNewFaculty` is best-effort and must never block a submission; it also declines to write when the roster failed to load, since it cannot tell a new person from an unseen one and guessing wrong adds a permanent duplicate. Render roster names through `escFaculty()`/`facultyDatalistOptions()` — anonymous self-registration means `faculty.name` is untrusted input by the time it is drawn back into a page.

Each row stores both `faculty_name` and `faculty_id` (see [sql/006_add_faculty_id.sql](sql/006_add_faculty_id.sql)) — the mirror of `evaluator_id` on the EPA side: the typed name is the historical record, the id is how identity resolves going forward. `NULL` means "identified by name only"; never backfill it by name matching. This does not affect the form's anonymity, since it names the subject of the evaluation rather than its author.

Each rating is stored as `{ item, rating }` with the question wording attached, and the dashboard reads it that way: `itemAveragesFor()` matches on that stored text, and `questionIndex()` builds the column order from the current `QUESTIONS` plus any wording found in the data that is no longer there. Aggregate ratings by stored text, never by array position — indexing into `s.ratings[i]` silently attributes old answers to whichever question now occupies that slot, which is what inserting or reordering an item used to do. Retired wording keeps its responses and sorts to the end.

**Camp HOPE surveys** — [camphope/index.html](camphope/index.html) (clinical team) and [camphope/partner/index.html](camphope/partner/index.html) (Family Justice Center partners) are two copies of the *same* survey engine differing only in the `SURVEY` object; [camphope/dashboard/index.html](camphope/dashboard/index.html) reads both. Item types are `single`, `multi`, `short`, `long`, `likert`, and `note`, with conditional display via `showIf` (either `{ q, in: [...] }` or `{ role }`, where role is derived from the q1 answer by `roleGroup()`). Both surveys write to the same `camp_hope_responses` table, discriminated by `survey` (`clinical_team` / `partner_fjc`) and `camp_year`.

## Two training programs

The EPA app serves two learner populations: Family Medicine residents (`fm`) and
Addiction Medicine fellows (`am`). They use **different ACGME milestone
vocabularies that collide by code**, and everything below exists to stop those
codes averaging together.

**The collision.** 15 of the 19 FM codes also exist in the 16-code AM set.
Four of them mean something entirely unrelated:

| Code | FM | AM |
| --- | --- | --- |
| `PC1` | Care of the Acutely Ill Patient | Screening, Evaluation, Differential Diagnosis, and Case Formulation |
| `PC2` | Care of Patients with Chronic Illness | Pharmacologic and Non-Pharmacologic Treatment |
| `MK1` | Medical Knowledge — Breadth and Depth | Neuroscience of Substance Use |
| `MK2` | Critical Thinking and Decision Making | Epidemiology and Clinical Presentation |

The other eleven — `SBP1-3`, `PBLI1-2`, `PROF1-3`, `ICS1-3` — are titled almost
identically, and `PBLI1` is word-for-word the same. **That half is the more
dangerous one**, because the similarity invites the conclusion that the codes can
be shared. They cannot: the AM level anchors are addiction-contextualised, and
milestones are reported to the ACGME *per program*, so a code averaged across
both populations belongs to neither program's report. Do not merge them, however
redundant two entries look side by side.

**How it is prevented.** Two mechanisms, one per layer:

- `epa_submissions.program` records which vocabulary the row's codes were drawn
  from — it is to `milestone_scores` what `scores_detail` is to `scores`. See
  [sql/010_add_program_discriminator.sql](sql/010_add_program_discriminator.sql).
- In [shared/definitions.js](shared/definitions.js) there is deliberately **no
  unkeyed `MILESTONE_DEFS` or `ROTATIONS`** to reach for. Every structure is
  keyed by program, and every accessor — `milestoneDefs()`, `rotationsFor()`,
  `activeEpas()`, `epaDefsFor()`, `rotationDetailFor()`, `rotationsWithDetail()`,
  `formVersionFor()` — takes the program as its first argument and **throws** via
  `assertProgram()` when it is missing or unknown. Throwing is the point: a page
  that fails to render is far cheaper to notice than a dashboard that renders the
  wrong number. Never add a convenience wrapper that defaults the program.

Read the program from the row (`sub.program`) when you have a submission in hand,
and from `PROGRAM` / `currentProgram` for view-level concerns. The dashboard shows
**one program at a time** and filters in `loadSubmissions()` — the same load-time
boundary as the camelCase mapping. Keep the filter there and nowhere else.

**`program` may be backfilled; the id columns may not.** The no-backfill rule
protects `evaluator_id` and `faculty_id`, where matching a name is a guess about
identity. `program` is not a guess: every row written before the fellowship
existed is a Family Medicine evaluation as a matter of chronology. 010's `DEFAULT
'fm'` does it in one statement.

**That default is temporary.** While it stands, a page that forgets to send
`program` silently files its evaluation as Family Medicine — the exact conflation
the column exists to prevent. [sql/011_drop_program_default.sql](sql/011_drop_program_default.sql)
removes it once both forms send the value explicitly, turning a silent misfiling
into a loud `23502`. Run 011 only after the AM form is deployed.

**Versions are per program.** `formVersion` lives in `PROGRAMS`, not as one
global — a change to the fellowship's EPAs says nothing about the residency's,
and bumping a shared number would misdate the other program's evaluations.

**Learners share the `residents` table**, discriminated by `residents.program`.
One roster, one loader, one place to get the filter wrong — the form and the
dashboard both scope their fetch, and a fellow appears in the residents picker if
either forgets.

**Shared outright** — the same attendings supervise both populations, so the same
name-drift problems apply and there is nothing to gain from a second copy:

- [shared/faculty-roster.js](shared/faculty-roster.js) and the `faculty` table
- [shared/detail-options.js](shared/detail-options.js) and the `detail_options` table
  (AM rotations get their **own categories** — reusing `subspecialty` would show
  the residency's accumulated values in the fellowship picker, and the `category`
  CHECK constraint in 009 must be extended before a new one is used)
- [shared/epa-form.js](shared/epa-form.js) — the whole form engine
- [shared/text-matching.js](shared/text-matching.js)
- `escFaculty()` for rendering any human-entered name

**The form pages do not fork the engine.** A second copy of the form would
reintroduce exactly the duplication `shared/` exists to prevent, so the engine
moved to [shared/epa-form.js](shared/epa-form.js) and both pages became
configuration. Adding a third program should mean a third short page and a third
entry in `PROGRAMS` — never a third engine.

**Everything else in this file still applies** — EPA ids stay append-only *per
program*, `scores_detail` is never rewritten, migrations run before the page that
needs them, and no id column is ever backfilled by name matching.

## The duplication that will bite you

These pages share no framework and little code. The data definitions have been extracted, but plenty of duplication remains:

- `ROTATIONS_BY_PROGRAM` (FM: 17 rotations, 111 EPAs), `MILESTONE_DEFS_BY_PROGRAM`, `SCALE_LABELS` and the faculty `QUESTIONS` used to be copy-pasted across four pages. They now live once in [shared/definitions.js](shared/definitions.js), loaded by a plain `<script>` before each page's own script — relative paths (`shared/…` from the root, `../shared/…` from a subdirectory) so opening a page straight from disk still works. `SCALE_OPTS` and `OVERALL_OPTS` stay inline in [faculty/index.html](faculty/index.html); they are page-specific. `SCALE_COLORS` and the `FORM_VERSION` constant are both gone: the first was dead code, and the version is now read per program with `formVersionFor(PROGRAM)` at submit time. **Bump the `?v=` on every `<script src>` after editing the shared file**, or browsers keep the cached copy.
- The camphope survey engine (`render`, `visible`, `isAnswered`, `buildResponses`, `submitForm`) is duplicated between the two form files. Fix a bug in one, fix it in the other.
- The `:root` design-token block (navy/gold/slate palette, VCMC header, footer) is duplicated in all eight pages, and the two EPA form pages duplicate their entire `<style>` block — they share JS, not CSS. Scale color tokens differ intentionally: `--scale-1..5` for the 0–5 EPA scale, `--scale-1..7` for the 1–7 faculty scale, `--adq-1..5` for camphope.

The camphope dashboard is the exception — it does **not** duplicate the survey definitions. Each stored response record is self-describing (`{ num, question, answer }`, or `{ num, question, scale, statements }` for likert), and `questionIndex()` reconstructs the questionnaire and infers each question's kind from the submitted rows. Preserve that self-describing shape in `buildResponses()` or the dashboard loses its labels.

## Conventions

- Rendering is `innerHTML` from template literals with an `esc()` helper on untrusted text; state lives in module-level `let` variables (`answers`, `ratings`, `allSubmissions`, `RAW`) and a full `render()` redraw on change.
- Rotation and question data is authored inline as JS object literals near the top of the `<script>` block, after the Supabase config.
- Dashboards offer client-side CSV export (`exportCSV`) and `window.print()` with print stylesheets — no server-side reporting.
- Column names are snake_case in payloads and camelCase after the load-time mapping in `loadSubmissions()`; keep that boundary in one place.
- Commits are single-file page edits; keep changes scoped to the page you are asked about rather than propagating a refactor across all seven.
