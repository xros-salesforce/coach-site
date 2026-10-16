# Plan: Personal site for a fitness coach / lifestyle blogger

## Context
A new website for the user's wife: a blogger focused on motherhood, fitness and bodybuilding coaching, lifestyle and nutrition. The site needs to:
- present who she is and what she offers
- show her latest Instagram posts automatically
- list her training and coaching events, and let women register for them with seat limits. Events can be **free or paid**, depending on the event.
- capture **contacts**, meaning women interested in future events, to build a lead base
- give her a simple admin area for managing events, registrations and contacts

It runs locally first, then deploys to free hosting. It is in Ukrainian only. **Online payment is a placeholder for now.** The code has a payment-provider interface, and for now a "manual" provider confirms payments: she receives a bank transfer or cash and marks the registration as paid in admin. A real provider (Monobank acquiring, WayForPay or LiqPay; Stripe doesn't serve Ukrainian merchants) can be added later without schema changes.

## Recommended stack and why
| Concern | Choice | Reason |
|---|---|---|
| Language | **TypeScript** | Typed end to end, has the largest web ecosystem, and is familiar territory for an architect coming from Apex/LWC |
| Framework | **Next.js 15 (App Router)** | One codebase covers SSR/ISR public pages, server actions for forms, and an admin area. Native to Vercel |
| DB + Auth | **Supabase** (free tier) | Postgres, Row Level Security, magic-link auth and storage for event images. Works locally with the Supabase CLI and Docker |
| Styling | **Tailwind CSS + shadcn/ui** | Fast and good-looking mobile-first UI. Admin forms and tables come ready-made |
| Validation | **Zod** + react-hook-form | One schema validates both client and server |
| Email | **Resend** (free tier: 3k/month) | Booking confirmation to the participant and a notification to her |
| Anti-spam | **Cloudflare Turnstile** (free) | Protects the public registration form |
| Hosting | **Vercel Hobby** (free) | Git-push deploys, ISR, and the daily cron needed for the Instagram token refresh |

Alternatives I considered and rejected: Astro would need a separate backend for bookings, and WordPress means PHP and slower, plugin-heavy maintenance. I'm only noting them here; the plan doesn't use them.

## Project location and structure
`~/projects/coach-site` (git repo, then pushed to GitHub, then linked to Vercel)

```
src/app/
  (public)/page.tsx            – Home: hero, short bio, services, latest Instagram, upcoming events
  (public)/about/page.tsx      – Her story: mother, coach, approach to nutrition and lifestyle
  (public)/services/page.tsx   – Coaching formats (personal, group, online, nutrition plans)
  (public)/events/page.tsx     – Upcoming events list
  (public)/events/[slug]/page.tsx – Event details + registration form
  (public)/gallery/page.tsx    – Larger Instagram grid
  (public)/contacts/page.tsx   – Contacts, social links
  (public)/unsubscribe/page.tsx – Marketing opt-out
  admin/                       – Protected: login, event types, events CRUD, registrations, contacts, CSV export
  api/cron/daily/route.ts      – Daily: Instagram token refresh, expire payment holds, keep Supabase awake
  api/payments/webhook/[provider]/route.ts – Stub for a future payment provider
src/lib/payments/{types,manual,index}.ts – PaymentProvider interface + ManualProvider
src/lib/supabase/{server,client}.ts
src/lib/instagram.ts           – Fetch media + token handling
src/lib/email.ts               – Resend templates
src/components/...             – UI (shadcn), EventCard, InstagramGrid, RegistrationForm
supabase/migrations/*.sql      – Schema, RLS, functions
supabase/seed.sql              – Sample events for local dev
```

## Data model (Supabase Postgres)
- **event_types**: id, code (`training` | `coaching` | `workshop` | `online` | …), name, **is_paid_default**, default_price_uah. The admin manages these, so the event type decides whether an event is free or paid by default.
- **events**: id, slug, title, description (markdown), event_type_id (FK), starts_at, ends_at, location, online_url, capacity, **is_paid** (pre-filled from the type and overridable per event), **price_uah** (numeric, null when free), payment_instructions (text for the manual provider, e.g. IBAN or "оплата на місці"), cover_image_path, status (`draft` | `published` | `cancelled`), created_at
- **contacts**: the lead base. id, full_name, email (unique, citext), phone, instagram_handle, interests (event-type codes array), source (`registration` | `interest_form` | `manual`), marketing_consent_at, unsubscribed_at, unsubscribe_token, notes, created_at, updated_at
- **registrations**: id, event_id (FK), **contact_id (FK)**, comment, consent_at, status (`confirmed` | `pending_payment` | `waitlist` | `cancelled` | `expired`), **hold_expires_at**, **amount_uah**, cancel_token (uuid), created_at. Unique (event_id, contact_id). Name, phone and email live on the contact.
- **payments**: the provider-agnostic placeholder. id, registration_id (FK), provider (`manual` for now), provider_ref, amount_uah, status (`pending` | `paid` | `failed` | `refunded`), raw_payload (jsonb, for future webhooks), paid_at, created_at
- **settings**: key/value, holding the Instagram long-lived token and expiry, `payment_hold_minutes` (15), and `manual_hold_hours` (e.g. 48)
- **View `events_public`**: published events + `seats_left` (counts `confirmed` + unexpired `pending_payment`)

**Registration RPC** `register_for_event(...)` (`SECURITY DEFINER`):
1. Upserts the **contact** by email, updating name, phone and Instagram handle, adding the event type to interests, and setting `source = registration` if new.
2. Locks the event row (`SELECT … FOR UPDATE`) and counts held seats.
3. If the event is full, the registration goes on the `waitlist`.
4. If the event is free, the registration is `confirmed`.
5. If the event is paid, the registration is `pending_payment` with `hold_expires_at` set, plus a `payments` row with status `pending`.

**Seat hold**: online providers will use the 15-minute hold. Until a provider exists, the manual provider uses the longer `manual_hold_hours`, so there's time for a bank transfer before she confirms. The daily cron, plus a check at registration time, flips expired holds to `expired`, which frees their seats and promotes the waitlist. (A precise 15-minute sweep can be added through `pg_cron` in Supabase once online payment goes live.)

**Payment abstraction**: `src/lib/payments/` with an interface `PaymentProvider { createCheckout(reg): {redirectUrl?|instructions}; handleWebhook(req): PaymentResult }`. The first implementation is `ManualProvider`, which returns `payment_instructions` and skips any redirect. `/api/payments/webhook/[provider]/route.ts` is created as a stub. Adding Monobank or WayForPay later means writing one new class plus env keys.

**RLS**: anonymous users can only read published events through the view. Inserts go only through the RPCs. Only the admin (an allowlisted email in an `admins` table) has full access to events, registrations, contacts and payments.

## Instagram integration
- Uses the **Instagram API with Instagram Login** (Business/Creator account; the old Basic Display API is shut down). One-time setup: a Meta developer app, adding her as a tester, and generating a long-lived token (valid 60 days).
- `lib/instagram.ts` fetches `/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` with `next: { revalidate: 3600 }`, which is hourly ISR. It renders images and video thumbnails, and each one links back to the Instagram permalink.
- The daily Vercel cron (`/api/cron/daily`) calls `refresh_access_token` once the token is older than about 30 days, then stores the new token in `settings`. If no token is set or the fetch fails, the site shows a "Follow on Instagram" fallback block.
- `next.config` sets `images.remotePatterns` for `*.cdninstagram.com` and `*.fbcdn.net`.

## Admin area
- `/admin` is protected by Supabase magic-link login. Middleware checks the session, and the server checks the `admins` allowlist.
- Events: list, create/edit (with cover image upload to Supabase Storage), publish/cancel.
- Event types: manage the list and free/paid defaults.
- Registrations per event: table with status changes. A **"Mark as paid"** action marks the payment `paid` and the registration `confirmed`, then sends the confirmation email. **CSV export**.
- **Contacts**: searchable list filtered by interest, source and consent. Add/edit by hand, notes, CSV export, and a registration history per contact.
- Optional, last in the phase: a "Notify interested contacts" button on a published event. It emails contacts whose interests match and who have marketing consent, through Resend in batches that respect the free-tier limits.
- No separate CMS. Static texts (bio, services) live in typed content files (`src/content/*.ts`), so editing them is a commit. A DB-backed editor could come later if she wants to edit them herself.

## Registration flow
1. The event page shows the form: name, phone, email, optional Instagram handle and comment, a consent checkbox for personal data processing (required under Ukrainian data protection law), and Turnstile.
   The form also has an optional checkbox: "Повідомляти мене про майбутні події" (tell me about future events), which sets `marketing_consent_at`.
2. A server action validates with Zod, verifies Turnstile, and calls the `register_for_event` RPC.
3. **Free event**: the person sees a "confirmed" screen. **Paid event**: `PaymentProvider.createCheckout` runs. For now that's the manual provider, so she sees the price, payment instructions and how long the seat is held.
4. Resend emails the participant. The email covers confirmed, pending payment or waitlist, with event details, a cancellation link using `cancel_token`, and an .ics file once confirmed. Resend also notifies her.
5. `/events/cancel?token=…` lets a participant cancel. Releasing a seat promotes the first person on the waitlist, who becomes confirmed or pending payment and is emailed.

## Interest form (lead capture)
- A "Хочу на наступну подію" block on Home, Events (especially when there are no upcoming events or an event is full) and Contacts. It asks for name, email, phone, interests (event types) and marketing consent, and is protected by Turnstile.
- A server action calls the `upsert_contact` RPC with `source = interest_form`. Interests are merged, never overwritten.
- Every marketing email has an unsubscribe link (`/unsubscribe?token=…`) that sets `unsubscribed_at`.

## SEO / UX
- Ukrainian `lang="uk"`, metadata per page, OpenGraph images, `sitemap.ts` and `robots.ts`, and JSON-LD `Event` schema on event pages.
- Mobile-first design, since most traffic will come from Instagram. Warm brand palette, to be agreed with her.
- Privacy policy page (`/privacy`), linked from the consent checkbox.

## Implementation phases
1. **Scaffold**: `create-next-app` (TS, Tailwind, App Router, src dir), shadcn init, ESLint/Prettier, git init.
2. **Local Supabase**: `supabase init` and `supabase start` (Docker), migrations, seed, and generated TS types (`supabase gen types`).
3. **Public pages** with placeholder content and layout (header, footer, nav).
4. **Events + registration**: RPCs, free and paid flow with the `ManualProvider`, hold expiry, form, emails, cancel flow, interest form.
5. **Admin**: auth, event types, events CRUD, registrations with "mark as paid", contacts, CSV, and the optional notify button.
6. **Instagram**: Meta app setup, token, feed component, cron refresh.
7. **Deploy**: create a Supabase cloud project and push migrations, create the GitHub repo, import it into Vercel, set env vars, add `vercel.json` cron, and optionally connect a custom domain (about $10/yr, the only non-free item).

## Environment variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_NOTIFY_EMAIL`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `CRON_SECRET`

## Free-tier caveats
- A Supabase free project **pauses after 7 days of no activity**. The daily Vercel cron touching the DB keeps it awake.
- Vercel Hobby is for non-commercial use under its terms. If coaching revenue grows, consider Vercel Pro, or Netlify/Cloudflare Pages.
- Without a custom domain, Resend can only send from its test domain, so a domain is effectively needed for real emails.

## Verification
- `npm run dev` + `supabase start`: browse all pages locally, register for a seeded event, and check that the confirmation email appears in the local Inbucket (Supabase's mail catcher) or the Resend test log.
- Concurrency check: a script fires around 20 parallel registrations at an event with capacity 5, and the result must be exactly 5 confirmed and the rest on the waitlist.
- Paid flow: register for a paid event and check that it's `pending_payment` and holds a seat. Run "Mark as paid" in admin and check that it becomes `confirmed` and the email is sent. Then let a hold expire (set `hold_expires_at` in the past, run the cron route) and check that the seat is freed and the waitlist promoted.
- Contacts: registering twice with the same email to different events gives one contact with merged interests. The interest form creates a contact with `source = interest_form`. Unsubscribe sets `unsubscribed_at`.
- RLS check: with the anon key, a direct `select` on `registrations`, `contacts` and `payments` must return nothing.
- Unit tests (Vitest) for the Zod schemas and Instagram mapping. Playwright e2e for register, cancel and waitlist promotion, and for admin login and event creation.
- `npm run build` passes. Lighthouse mobile ≥ 90.
- After deploy: smoke-test the prod URL, trigger the cron route manually with `CRON_SECRET`, and confirm the Instagram feed renders.
