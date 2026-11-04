-- Restore membership_role value already referenced by ADMIN-ORG.1 SQL (staff_admin_count, can_manage_club_venues).
-- Separate from function bodies so the new enum label is committed before use.

ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'admin';
