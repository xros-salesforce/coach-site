/** Resolves `next` and keeps it only if it stays on this site (blocks //evil.com, /\evil.com, https://…). */
export function safeTarget(next: string | null | undefined, base: string) {
  const fallback = new URL("/admin", base);
  if (!next) return fallback;
  try {
    const target = new URL(next, base);
    return target.origin === fallback.origin ? target : fallback;
  } catch {
    return fallback;
  }
}
