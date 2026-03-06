-- Phase 2: memberships.role nur Team-Rollen (head_coach erlauben, admin nicht – Systemadmin außerhalb).

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS memberships_role_check;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN (
    'trainer',
    'co_trainer',
    'head_coach',
    'parent',
    'player',
    'fan'
  ));
