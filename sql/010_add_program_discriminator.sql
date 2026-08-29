-- 010_add_program_discriminator.sql
-- Project: ubqecdyhgejqoweltagl  ·  Tables: public.epa_submissions, public.residents
--
-- WHY
--   The app was built for one learner population (Family Medicine residents) and
--   one milestone vocabulary. The Addiction Medicine fellowship adds a second of
--   each, and the two vocabularies collide by design of the ACGME numbering:
--
--     15 of the 19 FM milestone codes also exist in the 16-code AM set.
--
--   Four of those fifteen mean something entirely unrelated -
--
--     PC1   FM: Care of the Acutely Ill Patient
--           AM: Screening, Evaluation, Differential Diagnosis, and Case
--               Formulation of the Patient with or at Risk of Substance Use
--     PC2   FM: Care of Patients with Chronic Illness
--           AM: Pharmacologic and Non-Pharmacologic Treatment
--     MK1   FM: Medical Knowledge - Breadth and Depth
--           AM: Neuroscience of Substance Use and Addictive Disorders
--     MK2   FM: Critical Thinking and Decision Making
--           AM: Epidemiology and Clinical Presentation
--
--   - and the other eleven (SBP1-3, PBLI1-2, PROF1-3, ICS1-3) are titled almost
--   identically, which is the more dangerous half. AM PBLI1 and FM PBLI1 carry
--   the same title word for word. That similarity invites the conclusion that
--   they can share a code, and they cannot: the level anchors are
--   addiction-contextualised, and milestones are reported to the ACGME per
--   program. A code averaged across both populations belongs to neither
--   program's semi-annual report.
--
--   milestone_scores is an untyped JSON object. Without a discriminator a
--   fellow's PC1 and a resident's PC1 land in the same key and average
--   together. Nothing errors and the dashboard renders; the number is simply
--   wrong. resident-dashboard/index.html:1243 and :1375 accumulate by key over
--   every loaded row, so this happens on the first fellow evaluation submitted.
--
-- WHAT THIS COLUMN IS
--   The pointer to the vocabulary the row's milestone codes were drawn from.
--   It is to milestone_scores what scores_detail is to scores: the row already
--   records the codes, and this records what they meant.
--
-- WHY THE EXISTING ROWS MAY BE FILLED IN
--   CLAUDE.md forbids backfilling evaluator_id and faculty_id, because matching
--   a name is a guess about identity that may be wrong. This is not that. Every
--   row already on file is a Family Medicine resident evaluation because no
--   other program existed when it was written - a fact about chronology, not an
--   inference from the data. The DEFAULT below fills them in one statement.
--
-- SAFETY
--   Additive, with a default, so rows written by the currently deployed form
--   keep succeeding between this migration and the next deploy. Nothing is
--   rewritten and no existing column is read.
--
--   The default is deliberately temporary. While it stands, a page that forgets
--   to send `program` silently files its evaluation as Family Medicine - the
--   exact conflation this column exists to prevent. 011 drops it once every
--   form sends the value explicitly, after which a forgetful insert fails loud
--   instead of landing in the wrong program.

-- ── epa_submissions ────────────────────────────────────────────────────────
alter table public.epa_submissions
  add column if not exists program text not null default 'fm';

alter table public.epa_submissions
  drop constraint if exists epa_submissions_program_check;
alter table public.epa_submissions
  add constraint epa_submissions_program_check
  check (program in ('fm','am'));

comment on column public.epa_submissions.program is
  'Which training program, and therefore which milestone vocabulary the codes in milestone_scores and scores_detail belong to. fm = Family Medicine residency, am = Addiction Medicine fellowship. Never compare or average milestone codes across programs.';

create index if not exists epa_submissions_program_idx
  on public.epa_submissions (program);

-- The dashboard's common read is one program, newest first.
create index if not exists epa_submissions_program_created_at_idx
  on public.epa_submissions (program, created_at desc);

-- ── residents ──────────────────────────────────────────────────────────────
-- Fellows live on the same roster rather than a separate table: one loader, one
-- filter, and the discriminator is spelled the same way it is on the
-- submissions. The trade is that the filter must be remembered - the form and
-- the dashboard both scope their fetch by program, and a fellow appears in the
-- residents picker if either forgets.
alter table public.residents
  add column if not exists program text not null default 'fm';

alter table public.residents
  drop constraint if exists residents_program_check;
alter table public.residents
  add constraint residents_program_check
  check (program in ('fm','am'));

comment on column public.residents.program is
  'Which training program this learner belongs to. fm = Family Medicine resident, am = Addiction Medicine fellow. Pickers and dashboards must filter on this.';

create index if not exists residents_program_idx
  on public.residents (program, active);

-- ── Grants ─────────────────────────────────────────────────────────────────
-- 003 granted service_role SELECT table-wide, which covers new columns, and no
-- column-level grants exist on either table. Nothing further is needed.
--
-- RLS: the existing policies are unchanged. If any policy on epa_submissions
-- enumerates columns for INSERT, `program` must be added to it or anonymous
-- submissions will fail; check before deploying the form.
--
-- VERIFY:
--   curl -s "$SUPABASE_URL/rest/v1/epa_submissions?select=program&limit=1" -H "apikey: <anon key>"
--   42501 = column exists, RLS working.   42703 = this migration has not run.
--
--   select program, count(*) from public.epa_submissions group by program;  -- all fm
--   select program, count(*) from public.residents      group by program;   -- all fm
