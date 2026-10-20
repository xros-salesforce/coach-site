// PostToolUse (Edit|Write): shows the user what changed in a code file.
import { relative } from "node:path";
import { clip, isCode, print, readInput, root, run } from "./lib.mjs";

const input = readInput();
const file = input.tool_input?.file_path;
if (!file || !isCode(file)) process.exit(0);

const rel = relative(root, file);
if (rel.startsWith("..")) process.exit(0); // outside the project (e.g. scratchpad)

const tracked = run("git", ["ls-files", "--error-unmatch", rel]).ok;
const diff = tracked
  ? run("git", ["diff", "--no-color", "-U2", "--", rel]).out
  : run("git", ["diff", "--no-color", "--no-index", "--", "/dev/null", rel]).out; // new file
if (!diff.trim()) process.exit(0);

// The diff is against the last commit, so it covers every edit to this file since then.
const hunks = diff.slice(diff.indexOf("\n@@") + 1); // drop the diff/index/---/+++ header lines
const stat = (hunks.match(/^\+/gm) ?? []).length + "+ / " + (hunks.match(/^-/gm) ?? []).length + "−";
print({ systemMessage: `✎ ${rel} (${stat} since last commit)\n${clip(hunks, 60)}` });
