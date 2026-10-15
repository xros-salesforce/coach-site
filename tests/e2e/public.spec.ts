import { expect, test } from "@playwright/test";
import { placeholders } from "../../src/content/placeholders";
import { about, services, site } from "../../src/content/site";
import { Fixture, hasDb } from "./helpers";

test.skip(!hasDb, "needs local Supabase and .env.local");

const fx = new Fixture();
let event: { id: string; slug: string };
let draft: { id: string; slug: string };

test.beforeAll(async () => {
  await fx.assertReachable();
  // Fresh slugs are never cached, so these pages always reflect the database.
  event = await fx.createEvent({ capacity: 7, price: 350 });
  draft = await fx.createEvent({ status: "draft" });
});
test.afterAll(() => fx.cleanup());

test("home page shows her name, tagline and calls to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Вікторія Саксон" })).toBeVisible();
  await expect(page.getByText("Тренерка · Коуч · Мама")).toBeVisible();
  await expect(page.getByRole("link", { name: "Розклад подій" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Про мене" }).last()).toBeVisible();
});

test("every page in the menu opens", async ({ page, isMobile }) => {
  const pages = [
    ["Про мене", "/about"],
    ["Послуги", "/services"],
    ["Події", "/events"],
    ["Галерея", "/gallery"],
    ["Контакти", "/contacts"],
  ] as const;
  for (const [label, path] of pages) {
    await page.goto("/");
    if (isMobile) await page.getByLabel("Меню").click();
    await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("event page shows details and free seats", async ({ page }) => {
  await page.goto(`/events/${event.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Test event ${fx.run}`);
  await expect(page.getByText("Вільно 7 місць")).toBeVisible();
  await expect(page.getByText(/350\s*грн/)).toBeVisible();
});

test("seat count drops after a registration", async ({ page }) => {
  const other = await fx.createEvent({ capacity: 3 });
  await fx.registerOk(other.id, "seat-check");
  await page.goto(`/events/${other.slug}`);
  await expect(page.getByText("Вільно 2 місця")).toBeVisible();
});

test("drafts and unknown events show the 404 page and aren't indexed", async ({ page }) => {
  for (const slug of [draft.slug, `${fx.run}-missing`]) {
    await page.goto(`/events/${slug}`);
    await expect(page.getByRole("heading", { name: "Сторінку не знайдено" })).toBeVisible();
    // Next.js may emit the tag twice (head + streamed body); either one is enough.
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  }
});

test("gallery photos load and link to Instagram", async ({ page }) => {
  await page.goto("/gallery");
  const photos = page.locator('a[href^="https://www.instagram.com/p/"] img');
  await expect(photos.first()).toBeVisible();
  for (const img of await photos.all()) {
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test("About page shows her photo and achievements", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("img", { name: /медаллю/ })).toBeVisible();
  await expect(page.getByText("Топ-2", { exact: true })).toBeVisible();
});

test("no page scrolls sideways on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  for (const path of ["/", "/about", "/events", "/gallery", "/services", "/contacts", `/events/${event.slug}`]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("unfinished «…» content from site.ts never shows on a public page", async ({ page }) => {
  // The «…» parts of every placeholder string, e.g. "«від 600 грн»".
  const markers = placeholders({ site, about, services }).flatMap((p) => p.match(/«[^»]*»/g) ?? []);
  for (const path of ["/", "/about", "/services", "/events", "/gallery", "/contacts", "/privacy"]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    for (const marker of markers) expect(text, `${path} shows ${marker}`).not.toContain(marker);
    const badLinks = await page.locator('a[href*="«"], a[href*="%C2%AB"]').count();
    expect(badLinks, `${path} has a link with a placeholder`).toBe(0);
  }
});

test("a past event says it's over instead of offering registration", async ({ page }) => {
  const past = await fx.createEvent({ startsInDays: -2 });
  await page.goto(`/events/${past.slug}`);
  await expect(page.getByRole("heading", { name: "Подія завершилась" })).toBeVisible();
  await expect(page.getByText(/Вільно \d+/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Реєстрація" })).toHaveCount(0);
});

test("the phone menu closes after choosing a page or tapping outside", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  const menu = page.locator("header details");
  await page.goto("/");
  await page.getByLabel("Меню").click();
  await expect(menu).toHaveAttribute("open", "");
  await menu.getByRole("link", { name: "Події", exact: true }).click();
  await expect(page).toHaveURL("/events");
  await expect(menu).not.toHaveAttribute("open");

  await page.getByLabel("Меню").click();
  await expect(menu).toHaveAttribute("open", "");
  await page.mouse.click(20, 600); // empty space, well away from the dropdown
  await expect(menu).not.toHaveAttribute("open");
});
