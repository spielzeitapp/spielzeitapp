-- Plattformadmin bereitet Trainerrollen für noch nicht registrierte E-Mail-Adressen vor.
-- Nach Bestätigung derselben Auth-E-Mail wird nur die passende Mannschaftssaison zugeordnet.
CREATE TABLE IF NOT EXISTS public.pending_team_staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.membership_role NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id),
  CONSTRAINT pending_team_staff_invites_email_check CHECK (email = lower(btrim(email)) AND length(email) <= 254),
  CONSTRAINT pending_team_staff_invites_role_check CHECK (role IN ('head_coach', 'trainer', 'co_trainer'))
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_team_staff_invites_open_unique
  ON public.pending_team_staff_invites (team_season_id, email)
  WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS pending_team_staff_invites_email_open
  ON public.pending_team_staff_invites (email)
  WHERE accepted_at IS NULL;

ALTER TABLE public.pending_team_staff_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_team_staff_invites FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_prepare_team_staff_invite(
  p_team_season_id uuid,
  p_email text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_club_id uuid;
  v_existing_user uuid;
  v_invite_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin darf Trainer einladen.' USING ERRCODE = '42501';
  END IF;
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR length(v_email) > 254 OR v_role IS NULL
     OR v_role NOT IN ('head_coach', 'trainer', 'co_trainer') THEN
    RAISE EXCEPTION 'Gültige E-Mail und Trainerrolle erforderlich.' USING ERRCODE = '22023';
  END IF;

  SELECT t.club_id INTO v_club_id
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = p_team_season_id AND lower(ts.status::text) <> 'archived';
  IF v_club_id IS NULL OR NOT public.club_is_operable(v_club_id) THEN
    RAISE EXCEPTION 'Mannschaftssaison nicht verfügbar.' USING ERRCODE = 'P0002';
  END IF;

  SELECT u.id INTO v_existing_user
  FROM auth.users u
  WHERE lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;
  IF v_existing_user IS NOT NULL THEN
    PERFORM public.admin_assign_team_season_staff(p_team_season_id, v_existing_user, v_role);
    UPDATE public.pending_team_staff_invites
    SET accepted_at = now(), accepted_user_id = v_existing_user
    WHERE team_season_id = p_team_season_id AND email = v_email AND accepted_at IS NULL;
    RETURN jsonb_build_object('status', 'assigned', 'user_id', v_existing_user);
  END IF;

  INSERT INTO public.pending_team_staff_invites (team_season_id, email, role, invited_by)
  VALUES (p_team_season_id, v_email, v_role::public.membership_role, auth.uid())
  ON CONFLICT (team_season_id, email) WHERE accepted_at IS NULL
  DO UPDATE SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by, sent_at = NULL
  RETURNING id INTO v_invite_id;

  -- Bestätigung kann genau während des Anlegens stattgefunden haben.
  SELECT u.id INTO v_existing_user FROM auth.users u
  WHERE lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL LIMIT 1;
  IF v_existing_user IS NOT NULL THEN
    PERFORM public.admin_assign_team_season_staff(p_team_season_id, v_existing_user, v_role);
    UPDATE public.pending_team_staff_invites
    SET accepted_at = now(), accepted_user_id = v_existing_user
    WHERE id = v_invite_id;
    v_status := 'assigned';
  ELSE
    v_status := 'pending';
  END IF;
  RETURN jsonb_build_object('status', v_status, 'invite_id', v_invite_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_prepare_team_staff_invite(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_prepare_team_staff_invite(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_team_staff_invite_sent(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.pending_team_staff_invites SET sent_at = now()
  WHERE id = p_invite_id AND accepted_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mark_team_staff_invite_sent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_team_staff_invite_sent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_team_staff_invites(p_team_season_id uuid)
RETURNS TABLE (id uuid, email text, role text, created_at timestamptz, sent_at timestamptz,
  accepted_at timestamptz, accepted_user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT i.id, i.email, i.role::text, i.created_at, i.sent_at,
    i.accepted_at, i.accepted_user_id
  FROM public.pending_team_staff_invites i
  WHERE i.team_season_id = p_team_season_id
  ORDER BY i.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_team_staff_invites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_team_staff_invites(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_pending_team_staff_invites()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.pending_team_staff_invites%ROWTYPE;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL THEN RETURN NEW; END IF;
  FOR v_invite IN
    SELECT * FROM public.pending_team_staff_invites i
    WHERE i.email = lower(btrim(NEW.email)) AND i.accepted_at IS NULL
    FOR UPDATE
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.team_seasons ts JOIN public.teams t ON t.id = ts.team_id
        WHERE ts.id = v_invite.team_season_id
          AND lower(ts.status::text) <> 'archived'
          AND public.club_is_operable(t.club_id)
      ) THEN CONTINUE; END IF;
      INSERT INTO public.memberships (user_id, team_season_id, role)
      VALUES (NEW.id, v_invite.team_season_id, v_invite.role)
      ON CONFLICT (user_id, team_season_id) DO UPDATE SET role = EXCLUDED.role
        WHERE lower(memberships.role::text) IN ('head_coach', 'trainer', 'co_trainer');
      IF FOUND THEN
        UPDATE public.pending_team_staff_invites
        SET accepted_at = now(), accepted_user_id = NEW.id
        WHERE id = v_invite.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ein fehlerhafter Invite darf die Konto-Bestätigung nicht verhindern.
      RAISE WARNING 'Pending trainer invite could not be assigned: %', SQLSTATE;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_pending_team_staff_invites ON auth.users;
REVOKE ALL ON FUNCTION public.apply_pending_team_staff_invites() FROM PUBLIC;
CREATE TRIGGER trg_apply_pending_team_staff_invites
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.apply_pending_team_staff_invites();

SELECT pg_notify('pgrst', 'reload schema');
