-- 011_drop_program_default.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.epa_submissions, public.residents
--
--   ┌───────────────────────────────────────────────────────────────────────┐
--   │  APPLIED 2026-09-20. Nothing further to do.                           │
--   │                                                                       │
--   │  Kept as the record of what was run. Re-running it is harmless: a     │
--   │  `drop default` on a column that has none is a no-op, not an error,   │
--   │  so running it twice changes nothing.                                 │
--   │                                                                       │
--   │  Verified after the fact: both columns are NOT NULL with no default,  │
--   │  and no row on either table has a null `program`.                     │
--   └───────────────────────────────────────────────────────────────────────┘
--
-- WHY
--   010 added `program` with `default 'fm'` so that the migration could be
--   applied before the form that populates it, per the ordering rule in
--   CLAUDE.md. That default is a hazard once a second program exists: an
--   Addiction Medicine form that fails to send the value does not error, it
--   files the fellow's evaluation as a Family Medicine resident's and averages
--   a fellow's PC1 into a resident's PC1. That is the precise failure 010
--   exists to prevent, reintroduced by the compatibility shim.
--
--   Dropping the default converts that silent misfiling into a not-null
--   violation at insert time. The column stays NOT NULL; only the fallback goes.
--
-- SAFETY
--   Nothing is rewritten. Existing rows keep the value they have. The only
--   behaviour change is that an insert omitting `program` now fails.
--
--   Reversible: `alter table ... alter column program set default 'fm';`

alter table public.epa_submissions
  alter column program drop default;

alter table public.residents
  alter column program drop default;

-- VERIFY:
--   select column_default from information_schema.columns
--    where table_name = 'epa_submissions' and column_name = 'program';   -- NULL
--
--   Then submit one real evaluation from each form and confirm both land with
--   the right program before considering this done.
