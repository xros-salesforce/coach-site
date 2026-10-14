-- Core schema: event types, events, contacts (leads), registrations, payments, settings, admins.
-- Security model:
--   * RLS on every table. Anonymous visitors read only published events (via events_public).
--   * Public writes (registration, interest form, cancel) go through SECURITY DEFINER functions
--     that only service_role may execute — the Next.js server calls them after Turnstile checks.
--   * Admin access is granted to auth users listed in public.admins.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.registration_status as enum ('confirmed', 'pending_payment', 'waitlist', 'cancelled', 'expired');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.contact_source as enum ('registration', 'interest_form', 'manual');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  is_paid_default boolean not null default false,
  default_price_uah numeric(10, 2) check (default_price_uah is null or default_price_uah > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  event_type_id uuid not null references public.event_types (id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  online_url text,
  capacity int not null check (capacity > 0),
  is_paid boolean not null default false,
  price_uah numeric(10, 2),
  payment_instructions text,
  cover_image_path text,
  status public.event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at is null or ends_at > starts_at),
  constraint events_price_when_paid check (
    (is_paid and price_uah is not null and price_uah > 0) or (not is_paid and price_uah is null)
  )
);
create index events_status_starts_idx on public.events (status, starts_at);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email extensions.citext not null unique,
  phone text,
  instagram_handle text,
  interests text[] not null default '{}',
  source public.contact_source not null,
  marketing_consent_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_interests_idx on public.contacts using gin (interests);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  comment text,
  consent_at timestamptz not null,
  status public.registration_status not null,
  hold_expires_at timestamptz,
  amount_uah numeric(10, 2),
  cancel_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, contact_id)
);
create index registrations_event_status_idx on public.registrations (event_id, status, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  provider text not null default 'manual',
  provider_ref text,
  amount_uah numeric(10, 2) not null check (amount_uah > 0),
  status public.payment_status not null default 'pending',
  raw_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_registration_idx on public.payments (registration_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();
create trigger registrations_touch before update on public.registrations
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('payment_provider', '"manual"'),
  ('payment_hold_minutes', '15'),
  ('manual_hold_hours', '48');

insert into public.event_types (code, name, is_paid_default, sort_order) values
  ('training', 'Тренування', false, 1),
  ('coaching', 'Коучинг', true, 2),
  ('workshop', 'Майстер-клас', true, 3),
  ('online', 'Онлайн', false, 4);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Seats currently held: confirmed plus unexpired payment holds.
create function public.seats_left(p_event_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select e.capacity - (
    select count(*)::int from public.registrations r
    where r.event_id = e.id
      and (r.status = 'confirmed'
           or (r.status = 'pending_payment' and (r.hold_expires_at is null or r.hold_expires_at > now())))
  )
  from public.events e where e.id = p_event_id;
$$;

-- Hold length depends on the active payment provider: short for online checkout, long for manual transfer.
create function public.payment_hold_interval() returns interval
language sql stable security definer set search_path = '' as $$
  select case
    when (select value #>> '{}' from public.settings where key = 'payment_provider') = 'manual'
      then make_interval(hours => coalesce((select (value #>> '{}')::int from public.settings where key = 'manual_hold_hours'), 48))
    else make_interval(mins => coalesce((select (value #>> '{}')::int from public.settings where key = 'payment_hold_minutes'), 15))
  end;
$$;

create function public.payment_provider() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select value #>> '{}' from public.settings where key = 'payment_provider'), 'manual');
$$;

-- Put a registration into the "seat taken" state appropriate for its event (free → confirmed, paid → hold).
create function public._take_seat(p_registration_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
begin
  select e.* into v_event
  from public.events e join public.registrations r on r.event_id = e.id
  where r.id = p_registration_id;

  if v_event.is_paid then
    update public.registrations
      set status = 'pending_payment',
          hold_expires_at = now() + public.payment_hold_interval(),
          amount_uah = v_event.price_uah
      where id = p_registration_id;
    insert into public.payments (registration_id, provider, amount_uah)
      select p_registration_id, public.payment_provider(), v_event.price_uah
      where not exists (
        select 1 from public.payments where registration_id = p_registration_id and status = 'pending'
      );
  else
    update public.registrations
      set status = 'confirmed', hold_expires_at = null, amount_uah = null
      where id = p_registration_id;
  end if;
end;
$$;

-- Fill free seats from the waitlist (oldest first). Caller must hold the event row lock.
create function public._promote_waitlist(p_event_id uuid) returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_reg_id uuid;
begin
  while public.seats_left(p_event_id) > 0 loop
    select id into v_reg_id from public.registrations
      where event_id = p_event_id and status = 'waitlist'
      order by created_at
      limit 1;
    exit when v_reg_id is null;
    perform public._take_seat(v_reg_id);
    return next v_reg_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public-facing RPCs (service_role only; called from Next.js server actions)
-- ---------------------------------------------------------------------------
create function public.upsert_contact(
  p_full_name text,
  p_email text,
  p_phone text,
  p_instagram_handle text,
  p_interests text[],
  p_marketing_consent boolean,
  p_source public.contact_source
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_consent timestamptz := case when p_marketing_consent then now() end;
begin
  insert into public.contacts as c
    (full_name, email, phone, instagram_handle, interests, source, marketing_consent_at)
  values
    (trim(p_full_name), lower(trim(p_email)), nullif(trim(p_phone), ''), nullif(trim(p_instagram_handle), ''),
     coalesce(p_interests, '{}'), p_source, v_consent)
  on conflict (email) do update set
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, c.phone),
    instagram_handle = coalesce(excluded.instagram_handle, c.instagram_handle),
    interests = array(select distinct unnest(c.interests || excluded.interests) order by 1),
    marketing_consent_at = coalesce(excluded.marketing_consent_at, c.marketing_consent_at),
    -- Opting in again clears a previous unsubscribe.
    unsubscribed_at = case when excluded.marketing_consent_at is not null then null else c.unsubscribed_at end
  returning c.id into v_id;
  return v_id;
end;
$$;

create function public.register_for_event(
  p_event_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_instagram_handle text,
  p_comment text,
  p_marketing_consent boolean
) returns table (
  registration_id uuid,
  status public.registration_status,
  cancel_token uuid,
  hold_expires_at timestamptz,
  amount_uah numeric
)
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  v_type_code text;
  v_contact_id uuid;
  v_reg public.registrations;
begin
  -- Lock the event row: serialises concurrent registrations for the same event.
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'event_not_available' using errcode = 'P0001';
  end if;
  if v_event.starts_at <= now() then
    raise exception 'event_started' using errcode = 'P0001';
  end if;

  perform public._expire_holds(p_event_id);

  select code into v_type_code from public.event_types where id = v_event.event_type_id;
  v_contact_id := public.upsert_contact(
    p_full_name, p_email, p_phone, p_instagram_handle, array[v_type_code], p_marketing_consent, 'registration');

  select * into v_reg from public.registrations r
    where r.event_id = p_event_id and r.contact_id = v_contact_id;

  if found and v_reg.status in ('confirmed', 'pending_payment', 'waitlist') then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;

  if found then
    -- Re-registering after a cancellation or expired hold: reuse the row with a fresh token.
    update public.registrations r
      set status = 'waitlist', comment = nullif(trim(p_comment), ''), consent_at = now(),
          cancel_token = gen_random_uuid(), created_at = now(), hold_expires_at = null, amount_uah = null
      where r.id = v_reg.id;
  else
    insert into public.registrations (event_id, contact_id, comment, consent_at, status)
      values (p_event_id, v_contact_id, nullif(trim(p_comment), ''), now(), 'waitlist')
      returning * into v_reg;
  end if;

  if public.seats_left(p_event_id) > 0 then
    perform public._take_seat(v_reg.id);
  end if;

  return query
    select r.id, r.status, r.cancel_token, r.hold_expires_at, r.amount_uah
    from public.registrations r where r.id = v_reg.id;
end;
$$;

-- Expire stale payment holds (one event, or all when null) and refill from the waitlist.
-- Returns the registrations promoted off the waitlist so the app can email them.
create function public._expire_holds(p_event_id uuid default null) returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
begin
  for v_event_id in
    select distinct r.event_id from public.registrations r
    where r.status = 'pending_payment' and r.hold_expires_at <= now()
      and (p_event_id is null or r.event_id = p_event_id)
  loop
    perform 1 from public.events where id = v_event_id for update;

    update public.payments p set status = 'failed'
      from public.registrations r
      where p.registration_id = r.id and p.status = 'pending'
        and r.event_id = v_event_id and r.status = 'pending_payment' and r.hold_expires_at <= now();

    update public.registrations
      set status = 'expired'
      where event_id = v_event_id and status = 'pending_payment' and hold_expires_at <= now();

    return query select public._promote_waitlist(v_event_id);
  end loop;
end;
$$;

-- Called by the daily cron.
create function public.expire_holds() returns setof uuid
language sql security definer set search_path = '' as $$
  select public._expire_holds(null);
$$;

create function public.cancel_registration(p_cancel_token uuid)
returns table (registration_id uuid, event_id uuid, promoted uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
  v_promoted uuid[];
begin
  select * into v_reg from public.registrations r where r.cancel_token = p_cancel_token;
  if not found then
    raise exception 'registration_not_found' using errcode = 'P0001';
  end if;
  if v_reg.status in ('cancelled', 'expired') then
    return query select v_reg.id, v_reg.event_id, '{}'::uuid[];
    return;
  end if;

  perform 1 from public.events e where e.id = v_reg.event_id for update;

  update public.registrations r set status = 'cancelled', hold_expires_at = null where r.id = v_reg.id;
  update public.payments p set status = 'failed' where p.registration_id = v_reg.id and p.status = 'pending';

  select coalesce(array_agg(x), '{}') into v_promoted from public._promote_waitlist(v_reg.event_id) as x;
  return query select v_reg.id, v_reg.event_id, v_promoted;
end;
$$;

create function public.unsubscribe_contact(p_token uuid) returns boolean
language sql security definer set search_path = '' as $$
  update public.contacts set unsubscribed_at = coalesce(unsubscribed_at, now())
  where unsubscribe_token = p_token
  returning true;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs (authenticated, checked against public.admins)
-- ---------------------------------------------------------------------------
create function public.mark_registration_paid(p_registration_id uuid, p_provider_ref text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration_not_found' using errcode = 'P0001';
  end if;

  perform 1 from public.events where id = v_reg.event_id for update;

  -- An expired hold can still be honoured if a seat is free (e.g. the transfer arrived late).
  if v_reg.status = 'expired' and public.seats_left(v_reg.event_id) <= 0 then
    raise exception 'no_seats_left' using errcode = 'P0001';
  elsif v_reg.status not in ('pending_payment', 'expired') then
    raise exception 'not_awaiting_payment' using errcode = 'P0001';
  end if;

  update public.payments
    set status = 'paid', paid_at = now(), provider_ref = coalesce(p_provider_ref, provider_ref)
    where id = (
      select id from public.payments where registration_id = p_registration_id
      order by created_at desc limit 1
    );
  if not found then
    insert into public.payments (registration_id, provider, amount_uah, status, paid_at, provider_ref)
      select p_registration_id, public.payment_provider(), e.price_uah, 'paid', now(), p_provider_ref
      from public.events e where e.id = v_reg.event_id;
  end if;

  update public.registrations set status = 'confirmed', hold_expires_at = null where id = p_registration_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is executable by anon/authenticated unless granted here.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.seats_left(uuid) to anon, authenticated;
grant execute on function public.mark_registration_paid(uuid, text) to authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public read model
-- ---------------------------------------------------------------------------
create view public.events_public with (security_invoker = true) as
  select e.id, e.slug, e.title, e.description, e.starts_at, e.ends_at, e.location, e.online_url,
         e.capacity, e.is_paid, e.price_uah, e.payment_instructions, e.cover_image_path,
         t.code as type_code, t.name as type_name,
         greatest(public.seats_left(e.id), 0) as seats_left
  from public.events e
  join public.event_types t on t.id = e.event_type_id
  where e.status = 'published';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.event_types enable row level security;
alter table public.events enable row level security;
alter table public.contacts enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;

create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "event types are public" on public.event_types
  for select to anon, authenticated using (true);
create policy "admin manages event types" on public.event_types
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "published events are public" on public.events
  for select to anon, authenticated using (status = 'published');
create policy "admin manages events" on public.events
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin manages settings" on public.settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin manages contacts" on public.contacts
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin manages registrations" on public.registrations
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin manages payments" on public.payments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Anonymous visitors get nothing beyond the policies above; drop the broad default table grants.
revoke all on public.admins, public.settings, public.contacts, public.registrations, public.payments from anon;
revoke insert, update, delete on public.events, public.event_types from anon;
grant select on public.events_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for event cover images, admin-only writes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('event-covers', 'event-covers', true)
  on conflict (id) do nothing;

create policy "admin uploads event covers" on storage.objects
  for insert to authenticated with check (bucket_id = 'event-covers' and (select public.is_admin()));
create policy "admin updates event covers" on storage.objects
  for update to authenticated using (bucket_id = 'event-covers' and (select public.is_admin()));
create policy "admin deletes event covers" on storage.objects
  for delete to authenticated using (bucket_id = 'event-covers' and (select public.is_admin()));
