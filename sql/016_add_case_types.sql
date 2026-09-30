-- 016_add_case_types.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.epa_submissions
--
-- WHY
--   Continuity Care Clinic covers every kind of visit a family physician sees,
--   so one fixed list of EPAs either asks about care that did not happen that
--   day or leaves out care that did. From FM formVersion 2026.4 the form asks
--   the preceptor which types of care they precepted (acute, chronic illness,
--   mental health, preventive, prenatal, postpartum, office procedure) and
--   shows only the EPAs for those types, plus a few asked at every visit.
--
--   This column records that choice. It cannot be recovered from the scores:
--   an EPA marked N/A and an EPA never shown look the same in `scores`, and
--   "how many postpartum visits has this resident been precepted on" is a
--   question the program will ask for the ABFM core outcomes.
--
-- VALUE
--   The stable keys of the chosen types, in the form's order, e.g.
--   {acute,chronic}. Keys are defined per program and context in CASE_TYPES in
--   shared/definitions.js and, like EPA ids, are append-only: a key is never
--   renamed or reused, so a stored array always means what it meant.
--
--   NULL for every context that does not ask (all but Continuity Care Clinic
--   today, and every fellowship context), and for every row written before
--   this migration. Never backfill it: which types were precepted on an old
--   evaluation is not known, and a guess from its scores would be a fabricated
--   record.
--
-- SAFETY
--   Additive and nullable. Nothing existing is read or rewritten.
--
-- ORDER
--   Run this BEFORE pushing the form that sends `case_types`. The form sends
--   the column on every evaluation, both programs, so a page deployed ahead of
--   this migration makes every submission fail with 42703.

alter table public.epa_submissions
  add column if not exists case_types text[];

comment on column public.epa_submissions.case_types is
  'Keys of the types of care precepted (e.g. {acute,chronic}), for contexts that ask - see CASE_TYPES in shared/definitions.js. NULL when the context does not ask, and for rows before FM formVersion 2026.4. Never backfilled.';

-- Grants: 003 granted service_role SELECT table-wide, which covers new columns,
-- and no column-level grants exist on this table (see 001). Nothing further.
--
-- VERIFY:
--   curl -s "$SUPABASE_URL/rest/v1/epa_submissions?select=case_types&limit=1" -H "apikey: <anon key>"
--   42501 = column exists, RLS working.   42703 = this migration has not run.
