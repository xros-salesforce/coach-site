import { expect, test } from "@playwright/test";
import { Fixture, hasDb, kyivDateTime, signIn } from "./helpers";

test.skip(!hasDb, "needs local Supabase and .env.local");
test.describe.configure({ mode: "serial" });

// Each run uses its own temporary admin and data; real accounts are never touched.
const fx = new Fixture();
let adminEmail: string;
let strangerEmail: string;

test.beforeAll(async () => {
  await fx.assertReachable();
  adminEmail = (await fx.createUser("admin", { admin: true })).email;
  strangerEmail = (await fx.createUser("stranger")).email;
});
test.afterAll(() => fx.cleanup());

test.describe("access", () => {
  test("signed-out visitors are sent to the login page", async ({ page }) => {
    for (const path of ["/admin", "/admin/contacts", "/admin/events/new"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
  });

  test("login form gives the same answer for any address", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(`${fx.run}-nobody@example.com`);
    await page.getByRole("button", { name: "Надіслати посилання для входу" }).click();
    await expect(page.getByText("Перевірте пошту")).toBeVisible();
  });

  test("a signed-in account that isn't an admin is turned away", async ({ page }) => {
    await signIn(page, fx, strangerEmail);
    await expect(page).toHaveURL(/error=forbidden/);
    await expect(page.getByText("немає доступу")).toBeVisible();
    const csv = await page.request.get("/admin/export/contacts", { maxRedirects: 0 });
    expect(csv.status()).toBe(307);
  });

  test("a sign-in link works only once", async ({ page, browser }) => {
    const { data } = await fx.db.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
    const link = `/auth/confirm?token_hash=${data.properties!.hashed_token}&type=email&next=/admin`;
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Події" })).toBeVisible();
    const second = await browser.newPage();
    await second.goto(link);
    await expect(second).toHaveURL(/error=link/);
    await second.close();
  });

  test("signing out ends the session", async ({ page }) => {
    await signIn(page, fx, adminEmail);
    await page.getByRole("button", { name: "Вийти" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("managing events and registrations", () => {
  const title = `Тест адмінки ${fx.run}`;
  const when = kyivDateTime(30);
  let eventId: string;

  test.beforeEach(async ({ page }) => {
    await signIn(page, fx, adminEmail);
    await expect(page.getByRole("heading", { name: "Події" })).toBeVisible();
  });

  test("create a paid event (with validation) and see it on the site", async ({ page }) => {
    await page.goto("/admin/events/new");
    await page.getByLabel("Назва").fill(title);
    await page.getByLabel("Початок (за Києвом)").fill(when.local);
    await page.getByLabel("Кількість місць").fill("2");
    await page.getByLabel("Платна подія").check();
    await page.getByLabel("Статус").selectOption("published");
    await page.getByRole("button", { name: "Зберегти" }).click();

    // Missing price: error shown and nothing typed is lost.
    await expect(page.getByText("Вкажіть ціну в гривнях")).toBeVisible();
    await expect(page.getByLabel("Назва")).toHaveValue(title);
    await expect(page.getByLabel("Платна подія")).toBeChecked();

    await page.getByLabel("Ціна, грн").fill("300");
    await page.getByLabel("Як оплатити").fill("Картка 0000 0000 0000 0000");
    await page.getByRole("button", { name: "Зберегти" }).click();
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    const { data: ev } = await fx.db.from("events").select("*").eq("title", title).single();
    eventId = ev.id;
    fx.track(ev.id);
    expect(ev.slug).toBe(`test-adminky-${fx.run}`);
    expect(new Date(ev.starts_at).toISOString()).toBe(when.utc);
    expect(Number(ev.price_uah)).toBe(300);

    // Saving refreshes the public cache straight away.
    await page.goto("/events");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("mark as paid, cancel, and the waitlist moves up", async ({ page }) => {
    for (const label of ["olena", "maria", "iryna"]) await fx.registerOk(eventId, label, { consent: label === "olena" });
    await page.goto(`/admin/events/${eventId}/registrations`);
    const row = (label: string) => page.locator("tr", { hasText: `Test ${label}` });

    await expect(row("olena").getByText("Очікує оплати")).toBeVisible();
    await expect(row("iryna").getByText("Лист очікування")).toBeVisible();

    await row("olena").getByRole("button", { name: "Оплачено" }).click();
    await expect(row("olena").getByText("Підтверджено")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await row("maria").getByRole("button", { name: "Скасувати" }).click();
    await expect(row("maria").getByText("Скасовано")).toBeVisible();
    await expect(row("iryna").getByText("Очікує оплати")).toBeVisible();
  });

  test("dismissing the cancel prompt changes nothing", async ({ page }) => {
    await page.goto(`/admin/events/${eventId}/registrations`);
    const actions: string[] = [];
    page.on("request", (r) => r.method() === "POST" && actions.push(r.url()));
    page.once("dialog", (d) => d.dismiss());
    await page.locator("tr", { hasText: "Test olena" }).getByRole("button", { name: "Скасувати" }).click();
    await page.waitForLoadState("networkidle");

    // Nothing was sent, the database is unchanged, and a fresh page still shows her confirmed.
    expect(actions).toEqual([]);
    const { data: contact } = await fx.db.from("contacts").select("id").eq("email", fx.email("olena")).single();
    const { data: reg } = await fx.db.from("registrations").select("status").eq("contact_id", contact!.id).single();
    expect(reg?.status).toBe("confirmed");
    await page.reload();
    await expect(page.locator("tr", { hasText: "Test olena" }).getByText("Підтверджено")).toBeVisible();
  });

  test("registrations CSV downloads with readable names and phones", async ({ page }) => {
    const res = await page.request.get(`/admin/export/registrations/${eventId}`);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const csv = await res.text();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Test olena");
    expect(csv).toContain("Підтверджено");
  });

  test("contacts can be searched and filtered by consent", async ({ page }) => {
    await page.goto(`/admin/contacts?q=${fx.run}`);
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await page.getByLabel("Лише з дозволом на розсилку").check();
    await page.getByRole("button", { name: "Знайти" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("Test olena");
  });

  test("editing keeps Kyiv time, and a draft disappears from the site", async ({ page }) => {
    await page.goto(`/admin/events/${eventId}`);
    await expect(page.getByLabel("Початок (за Києвом)")).toHaveValue(when.local);
    await page.getByLabel("Статус").selectOption("draft");
    await page.getByRole("button", { name: "Зберегти" }).click();
    await expect(page).toHaveURL("/admin");
    await page.goto("/events");
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
