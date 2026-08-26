-- 009_add_detail_options.sql
-- Project: ubqecdyhgejqoweltagl
--
-- WHY
--   008 gave the three generic rotations a picklist, hardcoded in
--   shared/definitions.js with an "Other" box for anything missing. Whatever
--   was typed into Other was stored on the submission and then forgotten, so
--   the next evaluator typed it again, slightly differently. That is the same
--   failure the faculty roster had before it became a table.
--
--   This makes the list live and self-growing, exactly like public.faculty:
--   the form reads it, a genuinely new value registers itself, a near-miss is
--   offered to the person before a second spelling is created, and duplicates
--   that slip through can be merged by a reviewer in the dashboard.
--
-- ONE LIST FOR BOTH SUBSPECIALTY ROTATIONS
--   Inpatient and Outpatient Subspecialty share category 'subspecialty'.
--   They had near-identical hardcoded lists, and a specialty seen on the wards
--   is plausible in clinic. Two lists would drift apart for no benefit.
--
-- MERGES, NOT EDITS
--   merged_into mirrors faculty.merged_into: a reviewer records that two
--   options are the same thing, resolution happens at read time, and no
--   submission row is ever rewritten. Undo is `set merged_into = null`.

create table if not exists public.detail_options (
  id          bigserial primary key,
  category    text        not null check (category in ('procedure','subspecialty')),
  name        text        not null,
  active      boolean     not null default true,
  merged_into bigint      references public.detail_options(id),
  merged_at   timestamptz,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.detail_options is
  'Pickable values for epa_submissions.rotation_detail. Grows by self-registration from the form; duplicates are resolved with merged_into rather than by editing or deleting.';
comment on column public.detail_options.merged_into is
  'This option is the same thing as detail_options.id <merged_into>. Set by a reviewer; resolved at read time. Never set automatically.';

-- Case-insensitive uniqueness within a category. Makes the seed below and the
-- form's self-registration both idempotent, and stops the exact same spelling
-- being inserted twice by two people submitting at once.
create unique index if not exists detail_options_category_name_idx
  on public.detail_options (category, lower(name));

create index if not exists detail_options_merged_into_idx
  on public.detail_options (merged_into);

-- ── Seed: the lists previously hardcoded in shared/definitions.js ───────────
-- Reference data only - no identifiable information. Safe to re-run.
insert into public.detail_options (category, name) values
  ('procedure','Abscess incision and drainage'),
  ('procedure','Arthrocentesis / joint injection'),
  ('procedure','Central venous catheter'),
  ('procedure','Circumcision'),
  ('procedure','Colposcopy'),
  ('procedure','Cryotherapy'),
  ('procedure','Endometrial biopsy'),
  ('procedure','IUD insertion or removal'),
  ('procedure','Nexplanon insertion or removal'),
  ('procedure','Joint reduction'),
  ('procedure','Laceration repair'),
  ('procedure','Lumbar puncture'),
  ('procedure','Nail removal or nail bed repair'),
  ('procedure','Paracentesis'),
  ('procedure','Procedural sedation'),
  ('procedure','Skin biopsy (punch, shave, or excisional)'),
  ('procedure','Splinting or casting'),
  ('procedure','Thoracentesis'),
  ('procedure','Vasectomy'),
  ('subspecialty','Cardiology'),
  ('subspecialty','Dermatology'),
  ('subspecialty','Endocrinology'),
  ('subspecialty','Gastroenterology'),
  ('subspecialty','Hematology / Oncology'),
  ('subspecialty','Infectious Disease'),
  ('subspecialty','Nephrology'),
  ('subspecialty','Neurology'),
  ('subspecialty','Ophthalmology'),
  ('subspecialty','Orthopedics'),
  ('subspecialty','Otolaryngology'),
  ('subspecialty','Pain Medicine'),
  ('subspecialty','Palliative Care'),
  ('subspecialty','Psychiatry'),
  ('subspecialty','Pulmonology / Critical Care'),
  ('subspecialty','Rheumatology'),
  ('subspecialty','Sports Medicine'),
  ('subspecialty','Surgery'),
  ('subspecialty','Urology')
on conflict do nothing;

-- ── The submission points at the option, as well as naming it ──────────────
-- Same split as evaluator_id/evaluator_name: the text is what was chosen or
-- typed and stays the historical record; the id is what identity resolves
-- through, so a later merge reaches evaluations already filed.
alter table public.epa_submissions
  add column if not exists rotation_detail_id bigint;

comment on column public.epa_submissions.rotation_detail_id is
  'detail_options.id for rotation_detail, resolved at submission time. NULL means the row names its detail by text only. Never backfill by name matching.';

create index if not exists epa_submissions_rotation_detail_id_idx
  on public.epa_submissions (rotation_detail_id);

-- ── Grants ─────────────────────────────────────────────────────────────────
-- anon reads the list and registers genuinely new values, exactly as it does
-- for public.faculty. authenticated additionally records merges - column
-- scoped, so a dashboard login can merge and cannot rename or delete.
grant select, insert on public.detail_options to anon;
grant usage, select on sequence public.detail_options_id_seq to anon;
grant select on public.detail_options to authenticated;
grant update (merged_into, merged_at) on public.detail_options to authenticated;

-- RLS must be enabled on this table and three policies created; they are NOT
-- recorded here, because this repo is public and policy bodies do not belong in
-- it (see CLAUDE.md). Create them in the Supabase editor:
--   anon SELECT, anon INSERT, authenticated SELECT, authenticated UPDATE.
--
-- VERIFY after applying:
--   select category, count(*) from public.detail_options group by category;   -- 19 / 19
--   select relrowsecurity from pg_class where relname = 'detail_options';     -- expect t
--   select has_column_privilege('authenticated','public.detail_options','merged_into','UPDATE'); -- t
--   select has_column_privilege('authenticated','public.detail_options','name','UPDATE');        -- f
