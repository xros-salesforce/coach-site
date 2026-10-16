# Setting up coach-site on a new machine

Part 1 is for a person: install the tools, sign in to each service, check that everything works.
Part 2 is for Claude Code: project context that used to live only in local memory on the old machine.

Account names, project IDs and URLs below are not secret. **Passwords, tokens and keys never go into
this file, the chat with Claude or git.** Type them only into the terminal prompt or a website.

---

## Part 1 — For a person (about 30–45 minutes)

### 1. Install the tools (macOS)

| Tool | How | Check |
|---|---|---|
| Homebrew | https://brew.sh | `brew -v` |
| Git | `brew install git` | `git --version` |
| Node 22+ (the old machine has 24) | `brew install node` | `node -v` |
| Docker Desktop (local database) | https://www.docker.com/products/docker-desktop, then open it once | `docker ps` |
| VS Code + Claude Code extension | https://code.visualstudio.com, Extensions → "Claude Code" | — |

If `docker` isn't found in the terminal, add Docker's folder to PATH:
`echo 'export PATH="$HOME/.docker/bin:$PATH"' >> ~/.zshrc`, then open a new terminal.

### 2. GitHub access and the code

The code is at `github.com/xros-salesforce/coach-site` (private). Clone it over SSH:

```bash
ssh-keygen -t ed25519 -C "roman.skurchak@gmail.com"     # press Enter for the defaults
pbcopy < ~/.ssh/id_ed25519.pub                             # copies the PUBLIC key
```

Open GitHub → Settings → SSH and GPG keys → New SSH key, paste it, and save. Then:

```bash
ssh -T git@github.com                                      # should say "Hi xros-salesforce!"
mkdir -p ~/projects && cd ~/projects
git clone git@github.com:xros-salesforce/coach-site.git
cd coach-site
npm install
npx playwright install chromium webkit                     # browsers for the tests
```

### 3. Local database and `.env.local`

With Docker Desktop running:

```bash
npx supabase start            # the first run downloads images (several minutes)
```

It prints the local URL and keys. Create `.env.local` in the project folder as shown in
[README.md](../README.md#run-locally). The local keys are the same on every machine and only work
on your own computer.

```bash
npm run dev                   # open http://localhost:3000
```

### 4. Sign in to the cloud services

These logins are stored on the machine. Each one needs a token or password, so **do them yourself in
the terminal** (`!` before a command runs it from the Claude Code prompt, e.g. `! npx supabase login`).

**Supabase** (live database, project `coach-site`, Frankfurt):

1. Create a token at https://supabase.com/dashboard/account/tokens (any name, e.g. "new-mac").
2. Run `npx supabase login --token <paste the token here>`. Paste it in the terminal, not into the chat.
3. Run `npx supabase link --project-ref fghfakgfnzghlzkcadje`. If it asks for the database password and
   you don't have it, reset it in the dashboard → Project Settings → Database and save it in a password
   manager.

**Vercel** (hosting, team `skurchak`, project `coach-site`):

```bash
npx vercel login                                            # sign in as xros-salesforce (browser opens)
npx vercel link --yes --project coach-site --scope skurchak
```

`vercel link` adds a `VERCEL_OIDC_TOKEN` line to `.env.local`. That's expected, so leave it.

The secret keys for the live site already live in Vercel. You only need to re-run
`bash scripts/setup-vercel-env.sh` if the Supabase keys change.

### 5. Claude Code permissions (optional)

Auto mode blocks deploys and database changes unless you allow them. On the old machine these rules
were in `.claude/settings.local.json`, which isn't in git. To let Claude deploy without asking, create
that file:

```json
{
  "permissions": {
    "allow": [
      "Bash(npx supabase db push *)",
      "Bash(npx supabase config push *)",
      "Bash(npx vercel *)",
      "Bash(npx tsx scripts/add-admin.mts *)"
    ]
  }
}
```

### 6. Check that everything works

```bash
npm run test:all                       # typecheck, lint and all tests; needs `npx supabase start`
npx supabase projects list             # coach-site is marked as linked
npx vercel ls coach-site               # recent deployments
```

### What doesn't transfer, and doesn't need to

| Old machine | New machine |
|---|---|
| `.env.local`, `.vercel/`, `supabase/.temp/` | Created by steps 3–4 |
| `~/.claude/projects/...` (chat history, Claude's memory) | Not needed: the important parts are in Part 2 and [plan.md](plan.md) |
| `~/.claude/plans/idempotent-meandering-cascade.md` | Copied to [docs/plan.md](plan.md) |
| The local database contents (test events) | Rebuilt from migrations and `supabase/seed.sql` |

---

## Part 2 — For Claude Code

Read this before working on a new machine. Also read [AGENTS.md](../AGENTS.md), [README.md](../README.md)
and [plan.md](plan.md). On a new machine, start by running the checks in step 6. If a login is missing,
ask the user to run it themselves with the `!` prefix. Never ask for tokens in the chat.

### What the project is

A Ukrainian-language site for fitness coach **Вікторія Саксон** (Instagram @viktoria_sakson), the
user's wife. It has events with free and paid registration, a lead list and an admin area.

- Owner and main user: Roman, roman.skurchak@gmail.com.
- Admin emails: roman.skurchak@gmail.com and vikasakson@gmail.com. She doesn't use Telegram.
- Stack: Next.js 16.4 with Cache Components, Supabase, Tailwind/shadcn, Vitest and Playwright.
  Read `node_modules/next/dist/docs/` before writing Next.js code.

### Rules from the user

- **No photos with the child**, not even in the background. Check every image and list the ones you skipped.
- **No professional photo shoots for now** (for example @lipko.photo). Use only her own photos, and ask
  if an image looks professional.
- Use her full name **Вікторія**, never "Віка", on the site.
- The user prefers work done without asking about every step. Confirm only deploys, secret changes and
  anything hard to undo.
- Never print secrets, never repeat a password the user shared, and never send the user's email to
  unrelated services.
- Content changes go in `src/content/site.ts`. `npm run check:content` lists the «…» placeholders still left.

### Live setup

| What | Value |
|---|---|
| Live site | https://coach-site-two.vercel.app (also coach-site-skurchak.vercel.app) |
| Vercel | team `skurchak`, project `coach-site`, region `fra1` (`vercel.json`) |
| Supabase | project ref `fghfakgfnzghlzkcadje`, eu-central-1, legacy anon/service_role keys |
| Public env | committed in `.env.production` (URL and anon key, public by design) |
| Secret env | `SUPABASE_SERVICE_ROLE_KEY`, only in Vercel (`scripts/setup-vercel-env.sh`) |
| Deploy | `npx vercel deploy --prod` (Vercel isn't connected to GitHub, so a push doesn't deploy) |
| Database changes | new file in `supabase/migrations/`, test locally, then `npx supabase db push` |
| Auth settings | `npx supabase config push` pushes `supabase/config.toml`; see the warning below |

**Warning about `config push`:** `config.toml` holds local settings (`localhost` site URL, Turnstile
**test** secret). Pushing it as it is breaks the live login. Production values must go in a
`[remotes.production]` section (`project_id = "fghfakgfnzghlzkcadje"`), or be set in the dashboard.

Supabase's built-in email sends only to members of the Supabase organization, about 2 emails an hour.
Admins must be invited to the organization until custom SMTP (Resend plus a domain) is set up.

### Status as of 2026-10-15

Done: phases 1–3 and 5 (public pages, database, admin area), mobile check, first deploy. Every public
page works on the live site, and Вікторія is reviewing it.

Open, in order:

1. **Admin sign-in on the live site.** Set the Supabase site URL and redirect URL to the live domain,
   add the magic-link template and the 60 s limit, keep sign-ups off, and decide on the captcha. The
   choice is either a real Cloudflare Turnstile widget (recommended) or the captcha off for the test
   period. Then add both admins
   (`node --env-file=<cloud env> scripts/add-admin.mts ...`), invite them to the Supabase organization,
   and test on a phone.
2. Optionally connect Vercel to GitHub, so a push deploys automatically.
3. Content: the 5 service prices. Gallery: more of her own photos to reach 5. Skip DecQWxFDdBe and
   DdhATCCufC_ (professional); ask about CwcWN-ANlC8 and DdgUgKIDW1r.
4. Before the real launch: a domain, Resend SMTP, and phase 4 (registration form, payment-hold cron,
   double opt-in, event covers, robots/sitemap). Check that the CSV export (`;` separator) opens correctly
   in Excel.

Update this section when the status changes, so the next machine or session starts from the truth.
