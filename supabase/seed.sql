-- Local development sample data. Not applied to production.

insert into public.events
  (slug, title, description, event_type_id, starts_at, ends_at, location, capacity, is_paid, price_uah, payment_instructions, status)
values
  ('ranok-z-mamamy', 'Ранкове тренування для мам',
   'Функціональне тренування на свіжому повітрі. Можна з дітьми у візочках.',
   (select id from public.event_types where code = 'training'),
   date_trunc('day', now()) + interval '7 days 9 hours', date_trunc('day', now()) + interval '7 days 10 hours',
   'Київ, парк Наталка', 15, false, null, null, 'published'),

  ('kharchuvannia-bez-diet', 'Харчування без дієт: майстер-клас',
   'Як скласти раціон для схуднення та набору м''язової маси без жорстких обмежень.',
   (select id from public.event_types where code = 'workshop'),
   date_trunc('day', now()) + interval '14 days 18 hours', date_trunc('day', now()) + interval '14 days 20 hours',
   'Київ, студія Fit Space', 20, true, 600, 'Оплата на картку ФОП (реквізити надішлемо листом) або на місці.', 'published'),

  ('kouching-sylna-mama', 'Груповий коучинг «Сильна мама»',
   'Мала група: цілі, режим, тренування вдома. 4 зустрічі.',
   (select id from public.event_types where code = 'coaching'),
   date_trunc('day', now()) + interval '10 days 19 hours', null,
   'Онлайн (Zoom)', 2, true, 1500, 'Переказ на картку, реквізити в листі-підтвердженні.', 'published'),

  ('chernetka-podii', 'Чернетка — не має бути видно на сайті',
   'Перевірка RLS: ця подія не повинна з''являтися публічно.',
   (select id from public.event_types where code = 'training'),
   date_trunc('day', now()) + interval '30 days', null,
   'TBD', 10, false, null, null, 'draft');
