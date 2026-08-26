-- 007_add_faculty_merged_into.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.faculty
--
-- WHY
--   The old free-text fields let one person onto the roster more than once.
--   As of this migration the roster holds both:
--       id   7  "David Araujo"
--       id 181  "Araujo"
--   The picker stops new duplicates, but existing ones keep collecting
--   evaluations under a separate identity, and nothing should silently decide
--   that two names are one person.
--
--   merged_into records that decision explicitly, made by a human in the
--   dashboard. Marking 181 -> 7 means:
--     - 181 disappears from the pickers, so nobody selects it again
--     - submissions carrying faculty_id 181 resolve to 7 when displayed
--     - older submissions with no id whose typed name matches 181 also resolve to 7
--     - typing "Araujo" on a form still finds the person, and resolves to 7
--
-- WHAT IS NOT TOUCHED
--   Submission rows. epa_submissions and faculty_submissions keep exactly what
--   was typed and whatever id was captured at the time. A merge is a statement
--   about the roster, not a rewrite of history, and every dashboard resolves it
--   at read time. Undoing a merge is `set merged_into = null` and nothing is lost.
--
-- WHY NOT `active = false`
--   An inactive row still means "a real, separate person we no longer use".
--   A merged row means "not a separate person at all". Dashboards must still be
--   able to resolve a merged row to its target, so merging deliberately does not
--   deactivate. The two flags answer different questions.

alter table public.faculty
  add column if not exists merged_into bigint,
  add column if not exists merged_at   timestamptz;

comment on column public.faculty.merged_into is
  'This roster row is the same person as faculty.id <merged_into>. Set by a reviewer in the dashboard; resolved at read time. NULL means this row stands on its own. Never set automatically.';
comment on column public.faculty.merged_at is
  'When merged_into was last set. Cleared when a merge is undone.';

create index if not exists faculty_merged_into_idx
  on public.faculty (merged_into);

-- Dashboard accounts must be able to record and undo a merge. Column-scoped on
-- purpose: a dashboard login gains the ability to merge, and nothing else -- it
-- still cannot rename a person, deactivate one, or add one.
grant update (merged_into, merged_at) on public.faculty to authenticated;

-- An RLS policy allowing `authenticated` to UPDATE public.faculty is also
-- required, and is NOT recorded here: this repo is public, and policy bodies do
-- not belong in it (see CLAUDE.md). Create it in the Supabase editor. Note that
-- the column grant above is what keeps that policy from being broader than
-- intended -- the policy decides which rows, the grant decides which columns.
--
-- VERIFY after applying:
--
--   select id, name, merged_into from public.faculty where name ilike '%raujo%' order by id;
--
-- Use has_COLUMN_privilege, not has_table_privilege. The grant above is
-- column-scoped, and has_table_privilege(...,'UPDATE') asks about the whole
-- table -- it returns FALSE here, which is the desired result, not a failure:
--
--   select has_column_privilege('authenticated','public.faculty','merged_into','UPDATE') as merged_into_ok,
--          has_column_privilege('authenticated','public.faculty','merged_at','UPDATE')   as merged_at_ok,
--          has_column_privilege('authenticated','public.faculty','name','UPDATE')        as name_must_be_false;
--
-- Expect t, t, f. The f is the point: a dashboard login can record a merge and
-- cannot rename anyone.
--
--   select policyname, cmd, roles from pg_policies
--    where schemaname = 'public' and tablename = 'faculty';
