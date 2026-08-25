-- 002_add_form_version.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.epa_submissions
--
-- WHY
--   scores_detail (001) records what one evaluator saw on one evaluation.
--   form_version records which revision of the instrument produced it, so a
--   whole cohort can be identified without inspecting every row — "these 40
--   evaluations used the revised procedures EPA, these 200 did not".
--   Timestamps cannot answer that: the deploy that changes the form and the
--   date it takes effect are not the same event.
--
-- VALUE
--   A short string set from the FORM_VERSION constant at the top of
--   index.html, e.g. '2026.1'. Bump it whenever the measurement changes — an
--   EPA reworded, added, or retired, or a milestone mapping altered.
--
-- SAFETY
--   Additive and nullable. Rows written before this migration keep
--   form_version = NULL, which reads as "predates versioning". Do NOT
--   backfill them: the form that produced them was not this one, and any
--   value written now would be a guess presented as a record.

alter table public.epa_submissions
  add column if not exists form_version text;

comment on column public.epa_submissions.form_version is
  'Revision of the EPA instrument that produced this row, from FORM_VERSION in index.html. NULL means the row predates versioning — never backfill.';

-- Same column-grant caveat as 001. Zero rows here means table-level grants are
-- in use and the new column is already covered:
--
--   select a.attname, a.attacl
--     from pg_attribute a
--    where a.attrelid = 'public.epa_submissions'::regclass
--      and a.attnum > 0
--      and not a.attisdropped
--      and a.attacl is not null;
--
-- If it returns rows:
--   grant insert (form_version) on public.epa_submissions to anon;
--   grant select (form_version) on public.epa_submissions to authenticated;
