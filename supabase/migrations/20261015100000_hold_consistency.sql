-- Seat-accounting fixes from code review.
--
-- 1. Overdue payment holds. seats_left() already treats a pending_payment hold past hold_expires_at
--    as a free seat, so the waitlist can be promoted into it, but nothing marked the hold 'expired'
--    except register_for_event (there is no cron yet). An admin could then "mark paid" the overdue
--    hold and overbook the event. Every function that hands out or confirms a seat now sweeps
--    overdue holds for the event first (under the event lock), so they become 'expired' and go
--    through the "is a seat still free?" check.
-- 2. Lock order. mark_registration_paid and cancel_registration read the registration before
--    taking the event lock, so a concurrent cancel + mark-paid could resurrect a cancelled row.
--    Both now lock the event first and then re-read the registration.
-- 3. Promotion only for upcoming published events: cancelling a registration on a cancelled or past
--    event no longer creates payment holds; re-publishing a cancelled event promotes the waitlist.
-- 4. Public access no longer exposes online_url (meeting link) or payment_instructions: they are
--    for registered participants only (sent by email in phase 4).

-- ---------------------------------------------------------------------------
-- 3. Promote only for upcoming, published events (caller holds the event row lock).
-- ---------------------------------------------------------------------------
create or replace function public._promote_waitlist(p_event_id uuid) returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_reg_id uuid;
begin
  if not exists (
    select 1 from public.events where id = p_event_id and status = 'published' and starts_at > now()
  ) then
    return;
  end if;
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
-- 1 + 2. Mark paid: lock, sweep overdue holds, re-read, then check.
-- ---------------------------------------------------------------------------
create or replace function public.mark_registration_paid(p_registration_id uuid, p_provider_ref text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_reg public.registrations;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select event_id into v_event_id from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration_not_found' using errcode = 'P0001';
  end if;

  perform 1 from public.events where id = v_event_id for update;
  perform public._expire_holds(v_event_id);
  select * into v_reg from public.registrations where id = p_registration_id;

  -- An expired hold can still be honoured if a seat is free (e.g. the transfer arrived late).
  if v_reg.status = 'expired' and public.seats_left(v_event_id) <= 0 then
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
      from public.events e where e.id = v_event_id;
  end if;

  update public.registrations set status = 'confirmed', hold_expires_at = null where id = p_registration_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 + 2. Cancel: lock, re-read, sweep overdue holds, then promote.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_registration(p_cancel_token uuid)
returns table (registration_id uuid, event_id uuid, promoted uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_reg public.registrations;
  v_freed uuid[];
  v_promoted uuid[];
begin
  select r.event_id into v_event_id from public.registrations r where r.cancel_token = p_cancel_token;
  if not found then
    raise exception 'registration_not_found' using errcode = 'P0001';
  end if;

  perform 1 from public.events e where e.id = v_event_id for update;
  select * into v_reg from public.registrations r where r.cancel_token = p_cancel_token;

  if v_reg.status in ('cancelled', 'expired') then
    return query select v_reg.id, v_reg.event_id, '{}'::uuid[];
    return;
  end if;

  update public.registrations r set status = 'cancelled', hold_expires_at = null where r.id = v_reg.id;
  update public.payments p set status = 'failed' where p.registration_id = v_reg.id and p.status = 'pending';

  -- First sweep overdue holds (which also promotes into the seats they free), then fill the seat
  -- this cancellation freed.
  select coalesce(array_agg(x), '{}') into v_freed from public._expire_holds(v_event_id) as x;
  select coalesce(array_agg(x), '{}') into v_promoted from public._promote_waitlist(v_event_id) as x;
  return query select v_reg.id, v_reg.event_id, v_freed || v_promoted;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 + 3. Event edits: sweep overdue holds, confirm only live holds on paid→free, and also promote
-- when an event is (re-)published.
-- ---------------------------------------------------------------------------
create or replace function public._on_event_seats_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public._expire_holds(new.id);

  if old.is_paid and not new.is_paid then
    update public.payments p set status = 'failed'
      from public.registrations r
      where p.registration_id = r.id and p.status = 'pending'
        and r.event_id = new.id and r.status = 'pending_payment';
    update public.registrations
      set status = 'confirmed', hold_expires_at = null, amount_uah = null
      where event_id = new.id and status = 'pending_payment';
  end if;

  -- TODO(phase 4): email the promoted participants.
  perform public._promote_waitlist(new.id);
  return null;
end;
$$;

drop trigger events_seats_changed on public.events;
create trigger events_seats_changed
  after update of capacity, is_paid, status on public.events
  for each row
  when (
    new.capacity > old.capacity
    or old.is_paid is distinct from new.is_paid
    or (new.status = 'published' and old.status is distinct from 'published')
  )
  execute function public._on_event_seats_changed();

revoke execute on function public._promote_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public._on_event_seats_changed() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Public read model without the meeting link and payment instructions.
-- ---------------------------------------------------------------------------
drop view public.events_public;
create view public.events_public with (security_invoker = true) as
  select e.id, e.slug, e.title, e.description, e.starts_at, e.ends_at, e.location,
         e.capacity, e.is_paid, e.price_uah, e.cover_image_path,
         t.code as type_code, t.name as type_name,
         greatest(public.seats_left(e.id), 0) as seats_left
  from public.events e
  join public.event_types t on t.id = e.event_type_id
  where e.status = 'published';
grant select on public.events_public to anon, authenticated;

-- The view runs with the caller's rights, so anon needs SELECT on the columns it uses, and only those.
revoke select on public.events from anon;
grant select (id, slug, title, description, event_type_id, starts_at, ends_at, location, capacity,
              is_paid, price_uah, cover_image_path, status)
  on public.events to anon;
