import { describe, expect, it } from "vitest";
import { parseEventForm } from "./event-schema";

const TYPE_ID = "6f1d2f8e-0c4b-4a43-9f5e-2b8a0d1c3e4f";

function form(overrides: Record<string, string> = {}) {
  return {
    title: "Ранок з мамами",
    slug: "",
    description: "Опис",
    event_type_id: TYPE_ID,
    starts_at: "2026-11-20T10:00",
    ends_at: "",
    location: "Львів",
    online_url: "",
    capacity: "12",
    is_paid: "",
    price_uah: "",
    payment_instructions: "",
    status: "draft",
    ...overrides,
  };
}

describe("parseEventForm", () => {
  it("accepts a valid free event and normalises it for the database", () => {
    const result = parseEventForm(form());
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        slug: "ranok-z-mamamy",
        starts_at: "2026-11-20T08:00:00.000Z",
        ends_at: null,
        online_url: null,
        capacity: 12,
        is_paid: false,
        price_uah: null,
        payment_instructions: null,
      }),
    });
  });

  it("keeps a hand-written slug, cleaned up", () => {
    const result = parseEventForm(form({ slug: "Йога в парку!" }));
    expect(result.ok && result.data.slug).toBe("yoha-v-parku");
  });

  it("requires a price for paid events and accepts a comma decimal", () => {
    expect(parseEventForm(form({ is_paid: "on" }))).toEqual({
      ok: false,
      errors: { price_uah: "Вкажіть ціну в гривнях" },
    });
    const ok = parseEventForm(form({ is_paid: "on", price_uah: "350,50", payment_instructions: "IBAN UA…" }));
    expect(ok.ok && [ok.data.price_uah, ok.data.payment_instructions]).toEqual([350.5, "IBAN UA…"]);
  });

  it("drops price and payment instructions when the event is free", () => {
    const result = parseEventForm(form({ price_uah: "500", payment_instructions: "Картка" }));
    expect(result.ok && [result.data.price_uah, result.data.payment_instructions]).toEqual([null, null]);
  });

  it("rejects an end time before the start", () => {
    const result = parseEventForm(form({ ends_at: "2026-11-20T09:00" }));
    expect(result.ok ? null : result.errors.ends_at).toBe("Кінець має бути пізніше за початок");
  });

  it("reports each invalid field once, in Ukrainian", () => {
    const result = parseEventForm(
      form({ title: "Йо", event_type_id: "", starts_at: "", capacity: "0", online_url: "zoom.us/abc" }),
    );
    expect(result.ok ? null : result.errors).toEqual({
      title: "Вкажіть назву (від 3 символів)",
      event_type_id: "Оберіть тип події",
      starts_at: "Вкажіть дату й час початку",
      capacity: "Хоча б 1 місце",
      online_url: "Посилання має починатися з https://",
    });
  });

  it("rejects a title that can't become a web address", () => {
    const result = parseEventForm(form({ title: "!!!" }));
    expect(result.ok ? null : result.errors.slug).toBe("Адреса має містити літери або цифри");
  });

  it.each(["http://zoom.us/j/1", "javascript:alert(1)", "ftp://files.example.com", "https://localhost"])(
    "refuses online link %s",
    (online_url) => {
      const result = parseEventForm(form({ online_url }));
      expect(result.ok ? null : result.errors.online_url).toBe("Посилання має починатися з https://");
    },
  );

  it("accepts an https meeting link", () => {
    const result = parseEventForm(form({ online_url: "https://zoom.us/j/123" }));
    expect(result.ok && result.data.online_url).toBe("https://zoom.us/j/123");
  });

  it.each([
    ["Infinity", "Вкажіть ціну в гривнях"],
    ["abc", "Вкажіть ціну в гривнях"],
    ["-5", "Вкажіть ціну в гривнях"],
    ["1000001", "Ціна завелика — перевірте суму"],
  ])("refuses price %s", (price_uah, message) => {
    const result = parseEventForm(form({ is_paid: "on", price_uah }));
    expect(result.ok ? null : result.errors.price_uah).toBe(message);
  });

  it("reports a malformed end time instead of dropping it", () => {
    const result = parseEventForm(form({ ends_at: "20.11.2026 12:00" }));
    expect(result.ok ? null : result.errors.ends_at).toBe("Перевірте дату й час кінця");
  });

  it("explains a start time skipped when clocks go forward", () => {
    const result = parseEventForm(form({ starts_at: "2026-03-29T03:30" }));
    expect(result.ok ? null : result.errors.starts_at).toMatch(/^Такого часу немає/);
  });

  it("only allows known statuses", () => {
    expect(parseEventForm(form({ status: "deleted" })).ok).toBe(false);
  });
});
