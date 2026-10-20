// Stop: when code changed during the turn, runs typecheck + lint on it and asks Claude to review the
// changes for weak places before finishing. Each set of changes is reviewed once.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedCodeFiles, print, readInput, root, run, tail } from "./lib.mjs";

const input = readInput();
const files = changedCodeFiles();
if (!files.length) process.exit(0);

// Fingerprint of the current changes; the same changes are never reviewed twice in a session.
const diff = run("git", ["diff", "HEAD", "--", ...files]).out + files.join("\n");
const hash = createHash("sha1").update(diff).digest("hex");
// Keyed by project, not session: a resumed session gets a new id but shouldn't re-review old changes.
const stateFile = join(tmpdir(), `claude-review-${createHash("sha1").update(root).digest("hex").slice(0, 12)}`);
const seen = existsSync(stateFile) && readFileSync(stateFile, "utf8") === hash;
writeFileSync(stateFile, hash);
// stop_hook_active: Claude just did the review (and maybe fixed things); don't ask again for its own fixes.
if (seen || input.stop_hook_active) process.exit(0);

const tsc = run("npx", ["tsc", "--noEmit"]);
const lintable = files.filter((f) => /\.(tsx?|mts|jsx?|mjs)$/.test(f) && existsSync(join(root, f)));
const lint = lintable.length ? run("npx", ["eslint", "--no-warn-ignored", ...lintable]) : { ok: true, out: "" };

const checks = [
  `Typecheck: ${tsc.ok ? "OK" : "FAILED\n" + tail(tsc.out, 30)}`,
  `Lint: ${lint.ok ? "OK" : "FAILED\n" + tail(lint.out, 30)}`,
].join("\n");

print({
  decision: "block",
  reason: [
    `Code changed in: ${files.join(", ")}.`,
    checks,
    "Before finishing, review these changes (git diff HEAD) and the code that uses them for weak places:",
    "bugs and edge cases, missing error handling, security (RLS, auth, input validation, secrets),",
    "Next.js 16 / Cache Components misuse, duplication, and missing or outdated tests.",
    "Fix typecheck/lint failures you caused. Report the other findings to the user as a short list",
    "(most serious first, with file:line), or say none were found. Don't refactor unasked.",
  ].join("\n"),
});
