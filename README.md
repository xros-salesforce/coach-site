# coach-site

Ukrainian-language site for a fitness coach: events with free and paid registration, a lead list,
and an admin area. Next.js 16 (App Router, Cache Components) + Supabase + Tailwind/shadcn.

## Run locally

Requires Node 22+ and Docker (Docker Desktop or OrbStack).

```bash
npm install
npx supabase start          # local Postgres, auth, storage; applies migrations and seed data
npm run dev                 # http://localhost:3000
```

Create `.env.local` with the values printed by `npx supabase start`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Cloudflare Turnstile test key (always passes; pairs with the test secret in supabase/config.toml)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

Useful local URLs: Supabase Studio http://127.0.0.1:54323 · captured emails (Mailpit) http://127.0.0.1:54324

## Admin area

`/admin/login` signs in with a one-time email link. Only accounts added with the script can sign in:

```bash
node --env-file=.env.local scripts/add-admin.mts someone@example.com
```

Locally the sign-in email lands in Mailpit, not a real inbox.

Protection against someone spamming an admin's address (each new link cancels the previous one):

- Supabase Auth requires a Cloudflare Turnstile token for every sign-in request, including direct API calls
  with the public key (`[auth.captcha]` in `supabase/config.toml`).
- Sign-in links are requested from the browser, so Supabase's per-IP limits apply to the visitor.
- At most one email per address per minute (`max_frequency`).
- The emailed link opens a page with an "Увійти" button, so email scanners can't use it up.

### Going live checklist (Supabase dashboard + hosting env)

1. Create a Turnstile widget for the site's domain at Cloudflare (free). Put the site key in
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; enter the secret in Supabase → Auth → Bot and Abuse Protection (Turnstile).
2. Auth → Email: paste `supabase/templates/magic_link.html` as the Magic Link template; set the minimum
   interval between emails to 60 s; keep "Allow new users to sign up" off.
3. Auth → URL configuration: set the Site URL to the live domain.
4. Set up custom SMTP (e.g. Resend): Supabase's built-in mailer only emails project team members.
5. Create the admin accounts against the live project with `scripts/add-admin.mts`.
6. Run `npm run check:content`: it lists every «…» placeholder still left in `src/content/site.ts`
   (pages hide unfinished links and prompts, but the real texts, prices and contacts should be filled in).

## Content

Static texts, photos and links live in `src/content/site.ts`. Gallery images are in
`public/images/gallery/<instagram post code>.jpg`. Rules: no photos of the child, and no professional
shoots without the photographer's permission.

## Tests

| Command | What it covers | Needs |
|---|---|---|
| `npm test` | Unit tests: form validation, Kyiv time, slugs, CSV export, formatting | nothing |
| `npm run test:db` | Database rules: who can read/write what, seats, waitlist, payment holds, cancellation, concurrent sign-ups | `npx supabase start` |
| `npm run test:e2e` | Browser tests of the public site (desktop + phone) and the admin area | Supabase; starts `npm run dev` if needed |
| `npm run test:all` | Typecheck, lint, and all of the above | Supabase |

Browser tests use Playwright's Chromium (install once with `npx playwright install chromium`), or an
installed browser: `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e` (or `chrome`).

Database and browser tests create their own events, contacts and temporary users with unique names
and delete them afterwards, so real admin accounts and data are never touched.

Test files: `src/**/*.test.ts` (unit), `tests/db/` (database), `tests/e2e/` (browser).
