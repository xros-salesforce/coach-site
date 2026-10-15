import type { Page } from "@playwright/test";
import { Fixture } from "../db/helpers";

export { Fixture, hasDb } from "../db/helpers";

/** Signs the browser in as `email` by following a one-time sign-in link (same as the email button). */
export async function signIn(page: Page, fx: Fixture, email: string) {
  const { data, error } = await fx.db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=email&next=/admin`);
}
