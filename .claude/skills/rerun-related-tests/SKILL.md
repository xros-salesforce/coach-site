---
name: rerun-related-tests
description: Rerun only the tests related to code that just changed (after a refactor, rename, move or cleanup) and report the results. Use after refactoring code in coach-site, or when the user asks to "rerun related tests", "check the refactor didn't break anything" or similar.
---

# Rerun tests related to a refactor

A refactor shouldn't change behaviour, so the tests that cover the changed code must still pass
unchanged. Run the smallest set of tests that covers the change, fast checks first.

## 1. Find what changed

```bash
git diff --name-only HEAD; git ls-files --others --exclude-standard
```

If the user named a commit range (e.g. "the last 2 commits"), use `git diff --name-only <range>` instead.
Ignore docs, images and lockfiles.

## 2. Always: typecheck and lint

```bash
npx tsc --noEmit
npx eslint <changed .ts/.tsx/.mts/.mjs files>
```

A rename or a moved export usually shows up here first. Fix these before running tests.

## 3. Pick the tests from this map

| Changed files | Tests to run | Needs |
|---|---|---|
| Any `src/**` file | `npx vitest related --run --project unit <changed files>` (finds unit tests that import them, directly or indirectly) | nothing |
| A `*.test.ts` file itself | `npx vitest run <that file>` | nothing |
| `supabase/migrations/**`, `supabase/seed.sql`, `src/lib/events.ts`, `src/lib/supabase/**`, `tests/db/**` | `npm run test:db` | local Supabase |
| `src/app/(public)/**`, `src/components/site/**`, `src/content/**`, `src/app/layout.tsx`, `src/app/globals.css` | `npx playwright test tests/e2e/public.spec.ts` | local Supabase |
| `src/app/admin/**`, `src/app/auth/**`, `src/lib/admin/**`, `src/proxy.ts`, `src/components/turnstile.tsx` | `npx playwright test tests/e2e/admin.spec.ts` | local Supabase |
| `src/components/ui/**`, `src/lib/format.ts`, `src/lib/utils.ts` (shared by both areas) | both e2e specs | local Supabase |
| `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `playwright.config.ts`, `supabase/config.toml` | everything: `npm run test:all` | local Supabase |

Run the cheapest relevant ones first (unit, then db, then e2e). If a cheaper stage fails, stop there and
fix it before moving on.

## 4. Services

Database and browser tests need local Supabase. Check with
`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/rest/v1/`, and start it with
`npx supabase start` if needed (Docker must be running; see `docs/NEW-MACHINE.md`). Without it those
tests **skip** rather than fail. Never present skipped tests as passed.
Playwright starts `npm run dev` itself if nothing is on port 3000.

## 5. When a test fails

- Decide whether the refactor broke behaviour (fix the code) or the test depended on internals that
  legitimately moved, such as an import path or a renamed helper (update the test). Never weaken an
  assertion just to make it pass.
- Rerun only the failing file until it's green: `npx vitest run <file>` or `npx playwright test <file> -g "<name>"`.

## 6. Report

Give the user a short summary:

```
Related tests for: <changed files, grouped>
Typecheck ✓ · Lint ✓
Unit:  12 passed (vitest related, 3 files)
DB:    skipped — local Supabase not running
E2E:   public.spec 16 passed (desktop + mobile)
```

Then list any failures with the cause and what you changed. If anything was skipped, say what to run
to cover it (`npm run test:all` is the full suite; the pre-commit hook also runs it).
