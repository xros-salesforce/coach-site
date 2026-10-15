import type { Page } from "@playwright/test";
import { Fixture } from "../db/helpers";

export { Fixture, hasDb } from "../db/helpers";

/**
 * A Kyiv wall-clock time `days` from now at `hh:mm`, as typed into a datetime-local field, plus the
 * matching UTC instant. The offset comes from Intl's time-zone data, independent of src/lib/kyiv-time.
 */
export function kyivDateTime(days: number, hhmm = "10:00") {
  const day = new Date(Date.now() + days * 864e5);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
  const local = `${date}T${hhmm}`;
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")!.value.replace("GMT", "");
  return { local, utc: new Date(`${local}:00${offset}`).toISOString() };
}

/** The URL in the sign-in email for `email` (one-time). */
export async function signInLink(fx: Fixture, email: string) {
  const { data, error } = await fx.db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=email&next=/admin`;
}

/** Signs the browser in as `email`: opens the emailed link and presses "Увійти", like a person would. */
export async function signIn(page: Page, fx: Fixture, email: string) {
  await page.goto(await signInLink(fx, email));
  await page.getByRole("button", { name: "Увійти" }).click();
  await page.waitForURL((url) => url.pathname !== "/auth/confirm");
}
