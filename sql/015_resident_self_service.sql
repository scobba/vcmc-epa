-- 015_resident_self_service.sql
-- Project: ubqecdyhgejqoweltagl  ·  Tables: public.residents, public.program_staff
--
-- WHY
--   Residents need to read their own evaluations: EPA scores, the detail of each
--   evaluation, and the narrative comments. Nobody else's.
--
--   Today epa_submissions has one SELECT policy, granted to `authenticated`,
--   which returns every row. Handing a resident an account against that policy
--   would show them the whole program. The access has to be narrowed at the
--   same time it is widened, and that ordering is the dangerous part of this
--   change - see the RUN ORDER below.
--
-- WHAT IS IN THIS FILE
--   Schema only: one column, one table, the grants. The policy expressions and
--   the two helper functions are NOT here. Per CLAUDE.md this repo never
--   publishes a policy's `using (...)` body, and for this change that body IS
--   the authorization rule that keeps one resident out of another's record.
--   Those statements were supplied separately and run in the SQL editor; this
--   file records that they changed and what they are for.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The link between an auth account and a roster row.
--
--    A uuid pointing at auth.users.id. Deliberately an explicit link rather
--    than matching on email: an email match is a guess about identity, and this
--    codebase has already unwound that mistake twice (005, 006, 013). Getting
--    it wrong here does not mislabel a name - it shows one resident another
--    resident's evaluations.
--
--    UNIQUE so one account cannot be linked to two learners. NULL means the
--    learner has no account yet and simply cannot sign in.
--
--    No foreign key to auth.users: that schema is managed by Supabase, and a
--    deleted account should orphan the link rather than block the delete.

alter table public.residents
  add column if not exists auth_user_id uuid unique;

comment on column public.residents.auth_user_id is
  'auth.users.id of this learner''s own login, set by hand when their account is created. NULL means no account. Never populate by matching email - see 015.';

create index if not exists residents_auth_user_id_idx
  on public.residents (auth_user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The allowlist of accounts that keep program-wide access.
--
--    Explicit rather than inferred. The faculty table cannot serve this purpose:
--    its rows are self-registered by the anonymous forms, so anyone submitting
--    an evaluation can add one, and an authorization decision must never rest on
--    a table that untrusted input can write to.
--
--    Fail-closed by construction: an account in neither program_staff nor
--    residents.auth_user_id matches no policy and sees nothing at all.
--
--    RLS is enabled and NO policy is created for it. Nothing reaches this table
--    through PostgREST. The policies that consult it do so through a
--    security-definer function, so they are not affected by that.

create table if not exists public.program_staff (
  auth_user_id uuid primary key,
  note         text,
  created_at   timestamptz not null default now()
);

comment on table public.program_staff is
  'Accounts with program-wide read access to evaluations. An account not listed here, and not linked from residents.auth_user_id, sees nothing. Maintained by hand in the SQL editor.';

alter table public.program_staff enable row level security;

grant select on public.program_staff to service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- RUN ORDER - the part that will bite if rushed
--
--   Narrowing the existing policy before the current dashboard accounts are
--   listed in program_staff locks YOU out of the dashboard. Getting it the
--   other way round - adding the resident policy before narrowing the faculty
--   one - shows every resident the whole program, silently, with no error and
--   nothing in any log.
--
--   So:
--     1. Run this file.
--     2. Find the existing dashboard accounts:  select id, email from auth.users;
--     3. Insert those ids into program_staff.
--     4. Confirm the dashboard still works. It will: the policy has not moved.
--     5. Create the two helper functions (supplied separately).
--     6. Narrow the faculty policy, then add the resident policy.
--     7. Confirm the dashboard STILL works, before any resident account exists.
--     8. Invite ONE resident, link their uuid, and verify from their account
--        that they see only their own rows - count them against the dashboard.
--     9. Only then invite the rest.
--
--   Step 8 is not optional. There is no staging environment here, so this is
--   tested against live evaluations, and the failure mode is a resident reading
--   a colleague's narrative comments with nothing to announce it.
--
-- VERIFY
--   select count(*) from public.program_staff;                     -- your staff accounts
--   select count(*) from public.residents where auth_user_id is not null;  -- linked learners
--   select policyname, roles, cmd from pg_policies
--    where tablename = 'epa_submissions';                          -- expect two SELECT policies
