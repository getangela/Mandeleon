-- Admin Dashboard — "in my personal stack" (the infinity-icon badge).
-- Before this, index.html computed the badge client-side from a hardcoded
-- exclusion list (STACK_EXCLUDED_NAMES: "HRT - Men", "Glucose Monitor",
-- "Sleep Monitor") plus a blanket exclusion for the Age Testing and
-- Cutting Edge categories — i.e. every tile showed the badge UNLESS it was
-- one of those. That worked fine while every tile was hand-authored by
-- Aeon herself, but it breaks down now that tiles get added one at a time
-- from admin.html: there's no way, from the dashboard, to say "I don't
-- personally use this one" for a newly catalogued product, short of
-- editing index.html's JS by hand every time.
--
-- `in_stack` makes it a real per-tile field instead, settable from a
-- checkbox in admin.html's Add/Edit form. Existing tiles are backfilled
-- below to the EXACT value they'd already compute under the old
-- hardcoded-exclusion logic, so nothing already live changes appearance.
-- Going forward, NEW tiles default to false (opt-IN, not opt-out) — see
-- tiles-admin-save.js — since a tile catalogued via the dashboard is no
-- longer guaranteed to be something Aeon actually uses herself.
ALTER TABLE tiles ADD COLUMN IF NOT EXISTS in_stack BOOLEAN NOT NULL DEFAULT true;

UPDATE tiles
SET in_stack = false
WHERE name IN ('HRT - Men', 'Glucose Monitor', 'Sleep Monitor')
   OR cats @> '["agetesting"]'::jsonb
   OR cats @> '["cuttingedge"]'::jsonb;
