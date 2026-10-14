// Admin forms use <input type="datetime-local">, which has no time zone. Events happen in Kyiv
// time, but the server may run in UTC (Vercel), so convert explicitly in both directions.
const TZ = "Europe/Kyiv";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function kyivParts(date: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" as shown on a Kyiv wall clock. */
export function toKyivInput(iso: string | null | undefined) {
  if (!iso) return "";
  const { y, m, d, h, min } = kyivParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}`;
}

/** "YYYY-MM-DDTHH:mm" on a Kyiv wall clock → ISO timestamp (UTC), or null if malformed. */
export function fromKyivInput(local: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [y, m, d, h, min] = match.slice(1).map(Number);
  const wanted = Date.UTC(y, m - 1, d, h, min);
  // Start from the wall time read as UTC, then correct by Kyiv's offset at that instant.
  // A second pass settles instants near a DST switch.
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = kyivParts(new Date(guess));
    guess += wanted - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  }
  return new Date(guess).toISOString();
}
