export type ContactFilters = { q?: string; interest?: string; consent?: boolean };

/** Reads contact filters from page searchParams or a route's URLSearchParams. */
export function contactFilters(sp: Record<string, string | string[] | undefined> | URLSearchParams): ContactFilters {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return typeof v === "string" && v ? v : undefined;
  };
  return { q: get("q"), interest: get("interest"), consent: get("consent") === "1" };
}

/**
 * Strips characters that have meaning in PostgREST filter syntax (separators, grouping, quoting,
 * wildcards), so a search can't alter the query. "_" stays: as a LIKE wildcard it only widens matches.
 */
export function searchTerm(q: string | undefined) {
  return q?.replace(/[,()*%\\"]/g, " ").trim() || undefined;
}
