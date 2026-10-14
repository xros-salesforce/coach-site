const TZ = "Europe/Kyiv";

const dateFmt = new Intl.DateTimeFormat("uk-UA", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFmt = new Intl.DateTimeFormat("uk-UA", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("uk-UA", { timeZone: TZ, day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("uk-UA", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatShortDate = (iso: string) => shortFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function formatTimeRange(startsAt: string, endsAt: string | null) {
  return endsAt ? `${formatTime(startsAt)}–${formatTime(endsAt)}` : formatTime(startsAt);
}

export function formatPrice(priceUah: number | string | null) {
  if (priceUah === null) return "Безкоштовно";
  return `${Number(priceUah).toLocaleString("uk-UA")} грн`;
}

export function pluralSeats(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} місце`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} місця`;
  return `${n} місць`;
}
