-- 008_add_rotation_detail.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.epa_submissions
--
-- WHY
--   Three of the rotations added in FORM_VERSION 2026.2 describe a shape of
--   encounter rather than a subject:
--
--     Procedural Care                      - does not record WHICH procedure
--     Inpatient Subspecialty Consultation  - does not record WHICH subspecialty
--     Outpatient Subspecialty Clinic       - does not record WHICH subspecialty
--
--   Without this column every cardiology and neurology consult aggregates into
--   one undifferentiated bucket, and procedures cannot be counted at all - which
--   is the question a program actually needs answered about procedural training.
--
-- VALUE
--   Free text in the column, but chosen from a picklist in the form
--   (ROTATION_DETAIL in shared/definitions.js) so the values stay countable.
--   Free entry would recreate the spelling drift that faculty names had:
--   "central line", "Central Line" and "CVC" would each count separately.
--   The form's "Other" option writes whatever was typed, so a long tail is
--   possible and expected; a value appearing under Other repeatedly should be
--   promoted into the picklist.
--
--   NULL for every rotation that collects no detail, which is all 14 others, and
--   for rows written before this migration.
--
-- COUNTING
--   One evaluation is one procedure. The Procedural Care EPAs are written about
--   "the procedure" in the singular, so counting evaluations per resident per
--   value counts procedures. If a resident performs several of the same
--   procedure under one evaluation, this undercounts, and a separate quantity
--   column would be the fix - see the note in CLAUDE.md.
--
-- SAFETY
--   Additive and nullable. Nothing existing is read or rewritten.

alter table public.epa_submissions
  add column if not exists rotation_detail text;

comment on column public.epa_submissions.rotation_detail is
  'Which procedure or subspecialty this evaluation was about, for rotations that are otherwise generic. Chosen from a picklist in the form. NULL when the rotation collects no detail.';

create index if not exists epa_submissions_rotation_detail_idx
  on public.epa_submissions (rotation_detail);

-- Grants: 003 granted service_role SELECT table-wide, which covers new columns,
-- and no column-level grants exist on this table (see 001). Nothing further.
--
-- VERIFY:
--   curl -s "$SUPABASE_URL/rest/v1/epa_submissions?select=rotation_detail&limit=1" -H "apikey: <anon key>"
--   42501 = column exists, RLS working.   42703 = this migration has not run.
