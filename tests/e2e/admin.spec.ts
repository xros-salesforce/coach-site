import { expect, test } from "@playwright/test";
import { Fixture, hasDb, kyivDateTime, signIn, signInLink } from "./helpers";

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

  test("login form shows the spam check and gives the same answer for any address", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(`${fx.run}-nobody@example.com`);
    // The widget lives in a closed shadow root; its token lands in this hidden input. The test site key
    // solves itself, so wait for the token to appear.
    await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", { timeout: 15_000 });
    await page.getByRole("button", { name: "Надіслати посилання для входу" }).click();
    await expect(page.getByText("Перевірте пошту")).toBeVisible();
  });

  test("an admin's sign-in link arrives through the login form", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail);
    await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", { timeout: 15_000 });
    await page.getByRole("button", { name: "Надіслати посилання для входу" }).click();
    await expect(page.getByText("Перевірте пошту")).toBeVisible();
    // The local mail catcher received the link, and it points at the confirm page.
    const inbox = await (await page.request.get(`http://127.0.0.1:54324/api/v1/search?query=to:${encodeURIComponent(adminEmail)}`)).json();
    expect(inbox.messages?.length).toBeGreaterThan(0);
    const message = await (await page.request.get(`http://127.0.0.1:54324/api/v1/message/${inbox.messages[0].ID}`)).json();
    expect(message.HTML).toContain("/auth/confirm?token_hash=");
  });

  test("a signed-in account that isn't an admin is turned away", async ({ page }) => {
    await signIn(page, fx, strangerEmail);
    await expect(page).toHaveURL(/error=forbidden/);
    await expect(page.getByText("немає доступу")).toBeVisible();
    const csv = await page.request.get("/admin/export/contacts", { maxRedirects: 0 });
    expect(csv.status()).toBe(307);
  });

  test("opening the link doesn't sign in until \"Увійти\" is pressed (safe from link scanners)", async ({ page }) => {
    const link = await signInLink(fx, adminEmail);
    // An email scanner fetching the link must not use it up.
    expect((await page.request.get(link)).status()).toBe(200);
    await page.goto(link);
    await expect(page.getByRole("button", { name: "Увійти" })).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/); // still signed out
    await page.goto(link);
    await page.getByRole("button", { name: "Увійти" }).click();
    await expect(page.getByRole("heading", { name: "Події" })).toBeVisible();
  });

  test("a sign-in link works only once", async ({ page, browser }) => {
    const link = await signInLink(fx, adminEmail);
    await page.goto(link);
    await page.getByRole("button", { name: "Увійти" }).click();
    await expect(page.getByRole("heading", { name: "Події" })).toBeVisible();
    const second = await browser.newPage();
    await second.goto(link);
    await second.getByRole("button", { name: "Увійти" }).click();
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

  test("a large phone photo is shrunk before upload, and replacing it deletes the old file", async ({ page }) => {
    test.setTimeout(120_000);
    // A noisy 4000×3000 JPEG: several MB, well over the 1 MB default limit for server actions.
    const bigJpeg = async () =>
      Buffer.from(
        await page.evaluate(async () => {
          const canvas = Object.assign(document.createElement("canvas"), { width: 4000, height: 3000 });
          const ctx = canvas.getContext("2d")!;
          const img = ctx.createImageData(4000, 3000);
          for (let i = 0; i < img.data.length; i++) img.data[i] = (i % 4 === 3) ? 255 : Math.random() * 255;
          ctx.putImageData(img, 0, 0);
          const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.95));
          // Return base64: far cheaper to pass back to the test than an array of numbers.
          const dataUrl = await new Promise<string>((r) => {
            const reader = new FileReader();
            reader.onload = () => r(reader.result as string);
            reader.readAsDataURL(blob);
          });
          return dataUrl.slice(dataUrl.indexOf(",") + 1);
        }),
        "base64",
      );
    const coverPath = async () =>
      (await fx.db.from("events").select("cover_image_path").eq("id", eventId).single()).data!.cover_image_path as string | null;

    const upload = async () => {
      await page.goto(`/admin/events/${eventId}`);
      const original = await bigJpeg();
      expect(original.length).toBeGreaterThan(2 * 1024 * 1024);
      await page.locator("#cover").setInputFiles({ name: "phone.jpg", mimeType: "image/jpeg", buffer: original });
      await expect(page.getByRole("button", { name: "Зберегти" })).toBeEnabled({ timeout: 20_000 });
      const sent = await page.locator("#cover").evaluate((el: HTMLInputElement) => ({ type: el.files![0].type, size: el.files![0].size }));
      expect(sent.type).toBe("image/webp");
      expect(sent.size).toBeLessThan(original.length);
      await page.getByRole("button", { name: "Зберегти" }).click();
      await expect(page).toHaveURL("/admin");
      return coverPath();
    };

    const first = await upload();
    expect(first).toMatch(/\.webp$/);
    const second = await upload();
    expect(second).not.toBe(first);
    expect((await fx.coverFiles()).filter((name) => name.includes(fx.run))).toEqual([second]);
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
