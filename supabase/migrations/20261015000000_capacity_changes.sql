-- Keep registrations consistent when an admin edits an event's capacity or price.
--   * More seats → people on the waitlist get them, oldest first (free: confirmed; paid: payment hold).
--   * Paid → free → people holding a seat while waiting to pay are confirmed; their pending payments
--     are closed. (Free → paid leaves already-confirmed people confirmed: they signed up for free.)
--   * Fewer seats → nobody is removed; new sign-ups just go to the waitlist until seats free up.
-- Runs as a trigger so it applies to every way an event is edited (admin UI, Studio, SQL).
-- The UPDATE already holds the event row lock, so this serialises with register_for_event.

create function public._on_event_seats_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_paid and not new.is_paid then
    update public.payments p set status = 'failed'
      from public.registrations r
      where p.registration_id = r.id and p.status = 'pending'
        and r.event_id = new.id and r.status = 'pending_payment';
    update public.registrations
      set status = 'confirmed', hold_expires_at = null, amount_uah = null
      where event_id = new.id and status = 'pending_payment';
  end if;

  if new.status <> 'cancelled' then
    -- TODO(phase 4): email the promoted participants (as cancel_registration's callers will).
    perform public._promote_waitlist(new.id);
  end if;
  return null;
end;
$$;

create trigger events_seats_changed
  after update of capacity, is_paid on public.events
  for each row
  when (new.capacity > old.capacity or old.is_paid is distinct from new.is_paid)
  execute function public._on_event_seats_changed();

-- Like every other internal function: not callable by API roles.
revoke execute on function public._on_event_seats_changed() from public, anon, authenticated;
