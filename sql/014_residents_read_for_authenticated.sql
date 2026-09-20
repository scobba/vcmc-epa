-- 014_residents_read_for_authenticated.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.residents
--
-- WHY
--   The resident dashboard read `residents` with the signed-in session token and
--   got HTTP 403, while the anonymous evaluation form read the same rows
--   successfully. A signed-in user had LESS access than an anonymous one.
--
--   The cause is that `anon` and `authenticated` are separate Postgres roles.
--   `authenticated` is not a superset of `anon`, so a grant or policy written
--   for one does not reach the other. This table had exactly one policy,
--   scoped TO anon, and nothing for authenticated.
--
--   The consequence was not a visible error. learnerById came back empty, every
--   learner name on the dashboard silently fell back to the string stored at
--   submission time, and a resident renamed on the roster kept appearing under
--   her former name. The PGY case-mix adjustment was also doing nothing at all,
--   since it needs class_year from this table.
--
-- WHAT THIS DOES NOT CHANGE
--   Nothing becomes readable that was not already readable. This roster is
--   anon-readable by necessity - the evaluation form is deliberately login-free
--   and cannot render its learner picker otherwise - so extending the same read
--   to signed-in users exposes nothing new. It removes an asymmetry; it does
--   not widen access.
--
--   epa_submissions and faculty_submissions are untouched and stay closed to
--   anon. Those are the tables that hold narrative evaluations and the
--   anonymous faculty feedback.
--
-- NO POLICY BODY HERE, DELIBERATELY
--   Per CLAUDE.md this repo never publishes a policy's `using (...)` expression.
--   ALTER POLICY ... TO changes only the role list, so the existing expression
--   is preserved without being restated, and nothing about the authorization
--   logic is committed. The statements below are a grant and a role list, both
--   of which that rule permits.

-- 1. The table privilege. Harmless if already held: granting an existing
--    privilege is a no-op, not an error. This is the layer that produced the
--    403 - a grant denial is loud (42501), unlike an RLS denial, which returns
--    an empty result set with HTTP 200 and no error at all.
grant select on public.residents to authenticated;

-- 2. The policy's role list. Required even with the grant above: with RLS
--    enabled, a role matching no policy sees zero rows rather than an error.
alter policy anon_read_residents on public.residents
  to anon, authenticated;

-- 3. The name no longer describes what the policy does.
alter policy anon_read_residents on public.residents
  rename to roster_read_residents;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — expect the policy to list both roles
--
--   select policyname, roles, cmd
--     from pg_policies where tablename = 'residents';
--   -- roster_read_residents | {anon,authenticated} | SELECT
--
--   select grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'residents'
--      and privilege_type = 'SELECT'
--    order by grantee;
--
-- Then reload the dashboard. The console should no longer log a 403 from
-- loadLearners(), and the By Evaluator tab should resolve a training level for
-- every evaluation rather than falling back to the overall mean.
--
-- WORTH CHECKING ELSEWHERE
--   If this table's policies were written TO anon, others may have been too.
--   The same query over every table shows whether the asymmetry is isolated:
--
--   select tablename, policyname, roles, cmd
--     from pg_policies where schemaname = 'public'
--    order by tablename, policyname;
