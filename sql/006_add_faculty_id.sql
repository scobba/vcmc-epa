-- 006_add_faculty_id.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.faculty_submissions
--
-- WHY
--   The mirror of 005. That migration gave EPA evaluations a durable pointer to
--   the person doing the evaluating; this gives faculty evaluations one to the
--   person being evaluated. Until now faculty_name was the only identifier, so
--   two spellings of one attending are two people in every aggregate, and
--   correcting a name on the roster cannot reach evaluations already filed
--   under the old one.
--
--   Both identifiers are kept. faculty_name is what the resident typed and
--   remains the historical record; faculty_id is how identity resolves from
--   here.
--
-- TYPE
--   bigint, matching public.faculty.id.
--
-- ANONYMITY IS UNAFFECTED
--   faculty_submissions carries no identifier for the resident who submitted
--   it, and this column does not add one - it names the subject of the
--   evaluation, not its author. The form remains anonymous.
--
-- NO FOREIGN KEY, for the same reason as 005: an evaluation must never fail
--   because of a roster problem. The form writes NULL when it cannot resolve
--   an id. See 005 for how to add the constraint later if that trade changes.
--
-- SAFETY
--   Additive and nullable. Existing rows keep faculty_id = NULL, meaning
--   "identified by name only". Do NOT backfill by matching names against the
--   roster - a name that matches today may be a different person, and a guess
--   written into an evaluation record is indistinguishable from a fact.

alter table public.faculty_submissions
  add column if not exists faculty_id bigint;

comment on column public.faculty_submissions.faculty_id is
  'faculty.id of the attending being evaluated, resolved at submission time. NULL means the row identifies its subject by name only. Never backfill by name matching.';

create index if not exists faculty_submissions_faculty_id_idx
  on public.faculty_submissions (faculty_id);

-- Grants: 003 granted service_role SELECT on epa_submissions only. Check that
-- faculty_submissions is covered too, since the backup script reads it:
--   select has_table_privilege('service_role','public.faculty_submissions','SELECT');
-- Expect t. (003 did grant it; this is a reminder, not a new step.)
