-- 003_grant_service_role_read.sql
-- Project: ubqecdyhgejqoweltagl  (the eval project only)
--
-- WHY
--   tools/backup-supabase.ps1 authenticates as service_role. On this project the
--   grants were issued narrowly - anon INSERT, authenticated SELECT - and
--   service_role was never included, so every backup read failed with:
--
--     42501 permission denied for table residents
--     hint: GRANT SELECT ON public.residents TO service_role;
--
--   service_role bypasses Row Level Security but NOT table grants. Bypassing RLS
--   only decides which rows are visible; the underlying table privilege still has
--   to exist. This is the difference between "sees no rows" and "cannot read the
--   table at all", and it is why the anon key could read residents while the far
--   more privileged service_role key could not.
--
-- SCOPE
--   SELECT only. The backup script exclusively reads; it has no reason to hold
--   INSERT, UPDATE or DELETE on tables holding the only copy of this data.
--
--   The Camp HOPE project (zwfbppgkodhlpgsxcdry) already has working grants and
--   needs nothing from this file.

grant select on public.epa_submissions     to service_role;
grant select on public.faculty_submissions to service_role;
grant select on public.residents           to service_role;
grant select on public.faculty             to service_role;

-- Verify - expect four rows, all 'SELECT':
--
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'service_role'
--    order by table_name;

-- A table added later will NOT be covered by the statements above. Either add a
-- grant for it in a new numbered migration, or make it automatic once:
--
--   alter default privileges in schema public grant select on tables to service_role;
--
-- That applies only to tables created AFTER it runs, and only to those created by
-- the role that runs it - it is not retroactive.
