-- 001_add_scores_detail.sql
-- Project: ubqecdyhgejqoweltagl  ·  Table: public.epa_submissions
--
-- WHY
--   `scores` stores only { "med1": 3, "med2": "na" }. The EPA wording and the
--   milestone mapping live in the ROTATIONS object in index.html, so re-wording
--   an EPA silently relabels every evaluation ever submitted under that id.
--   `scores_detail` freezes the instrument as it stood at submission time.
--
-- SHAPE
--   A JSON *array*, in the order the EPAs were presented:
--     [ { "id": "med1",
--         "text": "Evaluate and manage an adult patient admitted with…",
--         "milestones": ["PC1","MK2"],
--         "score": 3 }, … ]
--   An array, not an object, because jsonb does not preserve object key order
--   and the display order of EPAs is meaningful.
--
-- SAFETY
--   Additive and nullable. No existing row is read, rewritten, or locked for
--   longer than the catalog update. Rows submitted before this migration keep
--   scores_detail = NULL, and resident-dashboard falls back to the current
--   ROTATIONS definitions for them (see epaRows()).

alter table public.epa_submissions
  add column if not exists scores_detail jsonb;

comment on column public.epa_submissions.scores_detail is
  'Ordered snapshot of each EPA (id, text, milestones, score) as worded at submission time. Append-only — never rewrite historical values.';


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK THIS BEFORE YOU CONSIDER THE MIGRATION DONE
--
-- If anon/authenticated were given COLUMN-level grants rather than table-wide
-- ones, the new column is not covered by them and submissions will start
-- failing with `permission denied for column scores_detail`.
--
-- Check by reading the column ACLs directly. attacl is non-null ONLY where a
-- grant was made against that specific column, so ZERO ROWS means no
-- column-level grants exist and the new column is already covered.
-- (Do not use information_schema.column_privileges for this — it expands
-- table-wide grants into one row per column and always looks non-empty.)
--
--   select a.attname, a.attacl
--     from pg_attribute a
--    where a.attrelid = 'public.epa_submissions'::regclass
--      and a.attnum > 0
--      and not a.attisdropped
--      and a.attacl is not null;
--
-- If that returns rows, extend the grants:
--
--   grant insert (scores_detail) on public.epa_submissions to anon;
--   grant select (scores_detail) on public.epa_submissions to authenticated;
--
-- If it returns nothing, table-wide grants are in effect and there is nothing
-- more to do. Row-level RLS policies need no change either way: this adds a
-- column, not a row-visibility rule.
--
-- Evidence as of 2026-08-25: an anonymous read of epa_submissions returns
-- 42501 "permission denied for TABLE epa_submissions" (not "for column"),
-- which indicates table-level grants are what is in use here.
