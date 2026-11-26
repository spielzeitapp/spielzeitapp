create schema if not exists auth_signup_mail;
revoke all on schema auth_signup_mail from public, anon, authenticated;

create table auth_signup_mail.outbox (
  delivery_id text primary key,
  user_id uuid not null,
  token_hash text not null,
  mail jsonb not null,
  expires_at timestamptz not null default now() + interval '15 minutes',
  available_at timestamptz not null default now(),
  lease uuid
);
alter table auth_signup_mail.outbox enable row level security;

select vault.create_secret(
  gen_random_uuid()::text || gen_random_uuid()::text, 'auth_signup_mail_worker'
) where not exists (select 1 from vault.secrets where name = 'auth_signup_mail_worker');

create function public.enqueue_auth_signup_mail(
  p_delivery_id text, p_user_id uuid, p_token_hash text, p_mail jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_delivery_id is null or length(p_delivery_id) not between 1 and 160
    or p_user_id is null or p_token_hash is null or length(p_token_hash) not between 32 and 128
    or p_mail is null or jsonb_typeof(p_mail) <> 'object' or pg_column_size(p_mail) > 65536 then
    raise exception 'Invalid signup mail';
  end if;
  insert into auth_signup_mail.outbox(delivery_id, user_id, token_hash, mail)
    values (p_delivery_id, p_user_id, p_token_hash, p_mail)
    on conflict (delivery_id) do nothing;
end;
$$;

create function public.claim_auth_signup_mail(p_worker_secret text)
returns table (delivery_id text, lease uuid, mail jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if p_worker_secret is null or not exists (
    select 1 from vault.decrypted_secrets
    where name = 'auth_signup_mail_worker' and decrypted_secret = p_worker_secret
  ) then
    raise insufficient_privilege;
  end if;

  return query with pending as (
    select q.delivery_id from auth_signup_mail.outbox q
    join auth.users u on u.id = q.user_id
      and u.confirmation_token = q.token_hash
      and u.email_confirmed_at is null
    where q.available_at <= now() and q.expires_at > now()
    order by q.available_at, q.delivery_id
    limit 4 for update of q skip locked
  )
  update auth_signup_mail.outbox q
    set lease = gen_random_uuid(), available_at = now() + interval '2 minutes'
    from pending where q.delivery_id = pending.delivery_id
    returning q.delivery_id, q.lease, q.mail;
end;
$$;

create function public.finish_auth_signup_mail(p_delivery_id text, p_lease uuid, p_delivered boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_delivered then
    delete from auth_signup_mail.outbox q where q.delivery_id = p_delivery_id and q.lease = p_lease;
  else
    update auth_signup_mail.outbox q set available_at = now() + interval '1 minute', lease = null
      where q.delivery_id = p_delivery_id and q.lease = p_lease;
  end if;
end;
$$;

revoke all on function public.enqueue_auth_signup_mail(text, uuid, text, jsonb),
  public.claim_auth_signup_mail(text), public.finish_auth_signup_mail(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.enqueue_auth_signup_mail(text, uuid, text, jsonb),
  public.claim_auth_signup_mail(text), public.finish_auth_signup_mail(text, uuid, boolean) to service_role;

create function auth_signup_mail.tick(p_origin text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_origin not in ('https://spielzeitapp.at', 'https://app.spielzeitapp.at') then
    raise exception 'Unknown signup mail origin';
  end if;
  delete from auth_signup_mail.outbox q where q.expires_at <= now();
  if exists (
    select 1 from auth_signup_mail.outbox q
    join auth.users u on u.id = q.user_id
      and u.confirmation_token = q.token_hash
      and u.email_confirmed_at is null
    where q.available_at <= now()
  ) then
    perform net.http_post(
      url := p_origin || '/api/parent/send-invite?auth_email_worker=1',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
          where name = 'auth_signup_mail_worker')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  end if;
end;
$$;
