-- 013_add_resident_id.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.epa_submissions
--
-- WHY
--   epa_submissions.resident is a name string copied from the roster at submit
--   time. Nothing links the row to residents.id, so the only way to connect an
--   evaluation to the learner it is about is to compare that string against
--   residents.name. That works only for as long as the name never changes.
--
--   It does change. Names get corrected, shortened, lengthened to match the
--   ACGME submission, or replaced outright. The moment the roster row is
--   edited, every evaluation already filed still carries the old string, and:
--
--     - the By Resident tab lists them as two people, each holding part of
--       their record, because the picker is built from submission strings;
--     - their older evaluations stop resolving to a class year, so pgyOf()
--       returns NULL and they silently drop out of the case-mix adjustment;
--     - every milestone aggregate splits across the two names.
--
--   None of that raises an error. resident_id makes the link survive the
--   rename: name and id are both kept, the name being what the evaluator saw
--   and the id being how identity resolves going forward. Same split as
--   evaluator_id (005), faculty_id (006) and scores_detail (001).
--
-- TYPE
--   bigint, matching public.residents.id.
--
-- NO FOREIGN KEY, DELIBERATELY
--   Exactly as 005: a real FK would let a roster problem reject an insert, and
--   an evaluation must never fail because of one. The form only ever writes an
--   id it just read from the roster, and writes NULL when it cannot resolve
--   one. To add the constraint later without disturbing existing rows:
--     alter table public.epa_submissions
--       add constraint epa_submissions_resident_fk
--       foreign key (resident_id) references public.residents(id)
--       on delete set null not valid;
--     alter table public.epa_submissions validate constraint epa_submissions_resident_fk;

alter table public.epa_submissions
  add column if not exists resident_id bigint;

comment on column public.epa_submissions.resident_id is
  'residents.id of the learner evaluated. NULL means the row identifies its learner by name only. Backfilled once in 013 from an exact, unique, same-program name match - see that file before ever doing it again.';

create index if not exists epa_submissions_resident_id_idx
  on public.epa_submissions (resident_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL — and why this one is allowed when 005 and 006 forbid it
--
--   005 and 006 say never to backfill an id column by matching names, and that
--   rule stands. It exists because evaluator_name and faculty_name are TYPED
--   FREE TEXT entered through an anonymous form that self-registers new roster
--   rows. Two spellings there may be one person or two, so an exact match is a
--   guess about identity, and a guess written into an assessment record is
--   indistinguishable from a fact.
--
--   epa_submissions.resident is categorically different: it is not typed. The
--   form renders a <select> whose options come straight from residents.name,
--   so every stored value is a verbatim copy of a roster row that existed at
--   submit time. An exact match does not infer a link - it RECOVERS one that
--   provably existed. That is a different operation from guessing.
--
--   Verified immediately before this migration was written:
--     * 97 of 97 submissions matched exactly one roster row within their own
--       program;
--     * 0 submission names matched nothing;
--     * 0 roster names were used by more than one row.
--
--   The window is the point. All of the above is true only while the names are
--   unedited. After a roster rename the old string matches nothing and the link
--   cannot be recovered by any automated means - only by someone remembering.
--   Run this before editing any learner's name, not after.
--
--   The predicate below re-checks every one of those conditions at run time, so
--   it stays correct even if it is run later under different data. Anything
--   ambiguous is left NULL rather than guessed.

update public.epa_submissions s
   set resident_id = r.id
  from public.residents r
 where s.resident_id is null
   and s.program  = r.program
   and s.resident = r.name
   and (select count(*)
          from public.residents r2
         where r2.name    = s.resident
           and r2.program = s.program) = 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — expect unlinked = 0 and linked = total
--
--   select count(*) filter (where resident_id is null) as unlinked,
--          count(*) filter (where resident_id is not null) as linked,
--          count(*) as total
--     from public.epa_submissions;
--
--   Any row left unlinked is one whose name no longer matches the roster. That
--   is information, not a failure: look at it rather than forcing it.
--
--   select distinct resident, program
--     from public.epa_submissions
--    where resident_id is null;
--
-- Column grants: 003 granted service_role SELECT on the whole table, which
-- covers new columns, and no column-level grants exist. Nothing further is
-- needed. Confirm with the probe if a submission starts failing:
--   curl -s "$SUPABASE_URL/rest/v1/epa_submissions?select=resident_id&limit=1" -H "apikey: <anon key>"
--   42501 = column exists, RLS working.   42703 = this migration has not run.
