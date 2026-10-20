// Shared helpers for the Claude Code hooks in this folder (wired up in .claude/settings.json).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Files whose changes count as "code": the hooks ignore docs, images and lockfiles.
export const isCode = (path) =>
  /\.(tsx?|mts|cts|jsx?|mjs|cjs|css|sql|toml)$/.test(path) && !/(^|\/)(node_modules|\.next)\//.test(path);

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return { ok: r.status === 0, status: r.status, timedOut: r.error?.code === "ETIMEDOUT", out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// Changed code files relative to HEAD, including new untracked ones.
// core.quotePath=false: real names for non-Latin paths instead of "\320\232..." escapes.
export function changedCodeFiles() {
  const tracked = run("git", ["-c", "core.quotePath=false", "diff", "--name-only", "HEAD"]).out;
  const untracked = run("git", ["-c", "core.quotePath=false", "ls-files", "--others", "--exclude-standard"]).out;
  return [...new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean))].filter(isCode);
}

export function clip(text, maxLines) {
  const lines = text.trimEnd().split("\n");
  return lines.length <= maxLines ? lines.join("\n") : [...lines.slice(0, maxLines), `… ${lines.length - maxLines} more lines`].join("\n");
}

export const tail = (text, n) => text.trimEnd().split("\n").slice(-n).join("\n");

export const print = (obj) => process.stdout.write(JSON.stringify(obj));
