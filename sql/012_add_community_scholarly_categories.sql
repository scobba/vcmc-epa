-- 012_add_community_scholarly_categories.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.detail_options
--
-- WHY
--   Two rotations were added to the Family Medicine set in FORM_VERSION 2026.3
--   to close the advocacy, quality-improvement and scholarship gaps Dr. O'Bryan
--   identified: Community Medicine and Scholarly & Quality Improvement Activity.
--   Both are generic rotations in the sense 008 describes -- they name a shape of
--   encounter, not a subject -- so each asks which instance it was, and those
--   answers need their own categories in detail_options.
--
--   'community_site'     which community site or activity (Westminster, TB Clinic, ...)
--   'scholarly_activity' which activity (M&M, Research Day, a QI project, ...)
--
-- WHY A NEW CATEGORY RATHER THAN REUSING ONE
--   Reusing 'subspecialty' or 'procedure' would put the residency's accumulated
--   values in the wrong picker -- an evaluator logging a Westminster session would
--   be offered Cardiology and Thoracentesis. The categories are what keep the
--   lists separate; there is no other partition.
--
-- THE CONSTRAINT MUST BE EXTENDED FIRST
--   009 wrote `check (category in ('procedure','subspecialty'))`. Until that is
--   widened, both the seed below and the form's self-registration are rejected by
--   Postgres with 23514, and an evaluator sees a failed submission they cannot
--   work around. This file widens it before inserting anything.

alter table public.detail_options
  drop constraint if exists detail_options_category_check;

alter table public.detail_options
  add constraint detail_options_category_check
  check (category in ('procedure','subspecialty','community_site','scholarly_activity'));

-- ── Seed: the starting lists from the reviewed draft ───────────────────────
-- Reference data only, no identifiable information. Safe to re-run: the unique
-- index from 009 is on (category, lower(name)).
--
-- These are a starting point, not a fixed list. The form self-registers anything
-- an evaluator types, so expect the tail to grow -- and a value that keeps
-- appearing should be promoted into this seed rather than left in the tail.
insert into public.detail_options (category, name) values
  ('community_site','Westminster Free Clinic'),
  ('community_site','Healthcare For Justice'),
  ('community_site','Tattoo Removal Clinic'),
  ('community_site','Public Health Nursing'),
  ('community_site','TB Clinic'),
  ('community_site','Radio Indigena (MICOP)'),
  ('community_site','Ask A Doctor (school outreach)'),
  ('community_site','Community sporting event'),
  ('community_site','Health fair'),
  ('scholarly_activity','USC Research Day'),
  ('scholarly_activity','AFMC Morbidity & Mortality'),
  ('scholarly_activity','Interesting Cases conference'),
  ('scholarly_activity','Quality improvement project'),
  ('scholarly_activity','Journal club'),
  ('scholarly_activity','Poster or abstract presentation'),
  ('scholarly_activity','Case report')
on conflict do nothing;

-- Tattoo removal is also a procedure. Dr. O'Bryan noted it fits either rotation,
-- and because the two lists are separate partitions the same activity can appear
-- in both -- the evaluator picks whichever rotation matches what they supervised.
insert into public.detail_options (category, name) values
  ('procedure','Tattoo removal')
on conflict do nothing;

-- No grant or policy work: 009 granted anon select/insert and authenticated
-- select plus a column-scoped update on this table, and none of that is
-- per-category.
--
-- VERIFY:
--   select category, count(*) from public.detail_options group by category order by 1;
--     community_site 9 · procedure 20 · scholarly_activity 7 · subspecialty 19
--
--   -- the constraint accepts the new values and still rejects nonsense:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.detail_options'::regclass and contype = 'c';
