# coach-site

Instructions for Claude Code. The details live in the files imported below, so edit those rather than
copying text here.

@AGENTS.md

## Project rules, live setup and status

@docs/NEW-MACHINE.md

## Working notes

- Background and design decisions: [docs/plan.md](docs/plan.md). Commands and tests: [README.md](README.md).
- Hooks (`.claude/settings.json`, scripts in `.claude/hooks/`): after each edit to a code file the user
  sees its diff; at the end of a turn with code changes you're asked to review them for weak places
  (do it, briefly); `git commit` first runs `npm run test:all` and is blocked if anything fails.
- After a refactor, use the `rerun-related-tests` skill rather than the full suite.
- When the status changes (a task done, a decision made, a new open item), update the "Status" section
  in `docs/NEW-MACHINE.md` in the same commit. It's how context reaches other machines and new sessions.
