-- 005_add_evaluator_id.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.epa_submissions
--
-- WHY
--   evaluator_name is a typed string, so it records a spelling rather than a
--   person. The roster picker added in the form makes a wrong spelling much
--   less likely, but it does not make identity durable: correcting a name on
--   the faculty roster cannot reach evaluations already saved under the old
--   one, and two spellings that did get through stay two people forever.
--
--   evaluator_id points at the faculty row instead. Name and id are both kept:
--   the name is what the evaluator actually typed and stays the historical
--   record, the id is what identity should be resolved through going forward.
--   This is the same split as scores_detail - store what was seen AND what it
--   meant, and never let one overwrite the other.
--
-- TYPE
--   bigint, matching public.faculty.id.
--
-- NO FOREIGN KEY, DELIBERATELY
--   A real FK would reject an insert carrying an id that no longer resolves,
--   and an evaluation must never fail because of a roster problem - the
--   evaluation is the record that matters. The form already only ever writes
--   an id it just read or created, and writes NULL when it cannot resolve one.
--   If you later want the constraint, add it without disturbing existing rows:
--     alter table public.epa_submissions
--       add constraint epa_submissions_evaluator_fk
--       foreign key (evaluator_id) references public.faculty(id)
--       on delete set null not valid;
--     alter table public.epa_submissions validate constraint epa_submissions_evaluator_fk;
--
-- SAFETY
--   Additive and nullable. Existing rows keep evaluator_id = NULL, meaning
--   "identified by name only". Do NOT backfill by matching names against the
--   roster: a name that matches today may be the wrong person, and a guess
--   written into an assessment record is indistinguishable from a fact.

alter table public.epa_submissions
  add column if not exists evaluator_id bigint;

comment on column public.epa_submissions.evaluator_id is
  'faculty.id of the evaluator, resolved at submission time. NULL means the row identifies its evaluator by name only. Never backfill by name matching.';

create index if not exists epa_submissions_evaluator_id_idx
  on public.epa_submissions (evaluator_id);

-- Column grants: 003 granted service_role SELECT on the whole table, which
-- covers new columns, and no column-level grants exist here (see 001). Nothing
-- further is needed. Confirm with the probe if a submission starts failing:
--   curl -s "$SUPABASE_URL/rest/v1/epa_submissions?select=evaluator_id&limit=1" -H "apikey: <anon key>"
--   42501 = column exists, RLS working.   42703 = this migration has not run.
