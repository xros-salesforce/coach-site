// PreToolUse (Bash `git commit`): runs the whole test suite first and reports the results.
// Blocks the commit when anything fails. Only Claude's commits pass through here, not manual ones.
import { print, readInput, run, tail } from "./lib.mjs";

// The `if` filter in settings.json should already limit this to commits; check again in case it doesn't.
const command = readInput().tool_input?.command ?? "";
// `git` at the start of a command, after a quote/backtick (`bash -c "git commit"`) or after a wrapper (`xargs git commit`).
const COMMIT = /(^|[;&|(`"']\s*|\b(xargs|env|exec|time|nice|command)\s+(\S+=\S*\s+)*)git\s+(-[cC]\s+\S+\s+|-\S+\s+)*commit\b/m;
if (!COMMIT.test(command)) process.exit(0);

const supabaseUp = run("curl", ["-s", "-o", "/dev/null", "-m", "2", "http://127.0.0.1:54321/rest/v1/"]).ok;
const started = Date.now();
// Stop before the hook's own 900 s limit: a hook killed by Claude Code doesn't block the commit, this does.
const r = run("npm", ["run", "test:all"], { timeout: 840_000, env: { ...process.env, CI: "", FORCE_COLOR: "0", NO_COLOR: "1" } });
r.out = r.out.replace(/\x1b\[[0-9;]*m/g, ""); // Vitest colors its output regardless
const secs = Math.round((Date.now() - started) / 1000);

// Result lines: Vitest "Tests  118 passed | 1 skipped (119)", Playwright "34 passed", "2 skipped", "1 failed".
const vitest = r.out.match(/^\s*Tests\s+.+$/m)?.[0].trim().replace(/\s+/g, " ");
const pw = ["passed", "failed", "flaky", "skipped"]
  .map((k) => r.out.match(new RegExp(`^\\s*(\\d+) ${k}`, "m")))
  .filter(Boolean)
  .map((m) => m[0].trim());
const stage = /error TS\d+/.test(r.out) ? "typecheck" : /✖ \d+ problems?/.test(r.out) ? "lint" : null;

const report = [
  `${r.ok ? "✅ All tests passed" : r.timedOut ? "⏱ Tests timed out" : "❌ Tests failed"} (${secs}s) — npm run test:all`,
  vitest && `Vitest: ${vitest}`,
  pw.length && `Playwright: ${pw.join(", ")}`,
  stage && `Stopped at: ${stage}`,
  !supabaseUp && "⚠ Local Supabase is not running: database and browser tests were skipped (npx supabase start).",
].filter(Boolean).join("\n");

if (r.ok) {
  print({
    systemMessage: report,
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: `Pre-commit test report:\n${report}\nInclude this report in your reply.` },
  });
} else {
  print({
    systemMessage: report,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `${report}\n\nCommit blocked. Last output:\n${tail(r.out, 40)}\n\nFix the failures (or report them to the user), then commit again.`,
    },
  });
}
