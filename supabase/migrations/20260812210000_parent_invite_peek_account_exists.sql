-- PARENT-INVITE.NEW-ACCOUNT-FIX
-- Token-bound peek: account_exists only for the invite recipient (no open enumeration).
-- account_exists = auth user with usable password (login). Passwordless OTP stubs → register.

CREATE OR REPLACE FUNCTION public.peek_parent_link_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token text := lower(trim(coalesce(p_token, '')));
  v_token_hash text;
  v_row public.parent_link_invites%ROWTYPE;
  v_account_exists boolean := false;
BEGIN
  IF v_token !~ '^[0-9a-f]{48}$' THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.parent_link_invites
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_used');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_row.recipient_email IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'ready',
      'recipient_email', NULL,
      'recipient_email_masked', NULL,
      'expires_at', v_row.expires_at,
      'account_exists', false
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_row.recipient_email
      AND u.encrypted_password IS NOT NULL
      AND length(u.encrypted_password) > 0
  )
  INTO v_account_exists;

  RETURN jsonb_build_object(
    'status', 'ready',
    'recipient_email', v_row.recipient_email,
    'recipient_email_masked', public.mask_parent_invite_email(v_row.recipient_email),
    'expires_at', v_row.expires_at,
    'account_exists', coalesce(v_account_exists, false)
  );
END;
$$;

COMMENT ON FUNCTION public.peek_parent_link_invite(text) IS
  'Token peek: status + optional recipient_email + account_exists (password account). No child data.';

REVOKE ALL ON FUNCTION public.peek_parent_link_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_parent_link_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION public.peek_parent_link_invite(text) TO authenticated;

-- Service-only helper for send-invite routing (no token required; not granted to anon/authenticated).
CREATE OR REPLACE FUNCTION public.parent_invite_auth_email_status(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := public.normalize_parent_invite_email(p_email);
  v_id uuid;
  v_has_password boolean := false;
BEGIN
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_email', 'exists', false, 'has_password', false);
  END IF;

  SELECT u.id,
         (u.encrypted_password IS NOT NULL AND length(u.encrypted_password) > 0)
  INTO v_id, v_has_password
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'exists', false, 'has_password', false, 'user_id', NULL);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'exists', true,
    'has_password', coalesce(v_has_password, false),
    'user_id', v_id
  );
END;
$$;

COMMENT ON FUNCTION public.parent_invite_auth_email_status(text) IS
  'Service-role helper: auth user existence + password for parent invite mail routing.';

REVOKE ALL ON FUNCTION public.parent_invite_auth_email_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.parent_invite_auth_email_status(text) FROM anon;
REVOKE ALL ON FUNCTION public.parent_invite_auth_email_status(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.parent_invite_auth_email_status(text) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
