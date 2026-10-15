import { describe, expect, it } from "vitest";
import { csvResponse, toCsv } from "./csv";

describe("toCsv", () => {
  it("starts with a BOM so Excel reads Cyrillic, separates with semicolons and quotes every field", () => {
    const csv = toCsv(["Ім'я", "Email"], [["Олена", "o@example.com"]]);
    expect(csv).toBe('﻿"Ім\'я";"Email"\r\n"Олена";"o@example.com"\r\n');
  });

  it("escapes quotes and keeps commas and line breaks inside a field", () => {
    const csv = toCsv(["Коментар"], [['Курс "Сильна мама", 2 рядки\nтут']]);
    expect(csv).toContain('"Курс ""Сильна мама"", 2 рядки\nтут"');
  });

  it("writes empty cells for null and undefined", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, 0]])).toContain('"";"";"0"');
  });

  it("neutralises values that a spreadsheet would run as formulas", () => {
    const csv = toCsv(["x"], [["=HYPERLINK(\"http://evil\")"], ["@SUM(A1)"], ["-2+3+cmd|' /C calc'!A0"]]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain(`"'@SUM(A1)"`);
    expect(csv).toContain(`"'-2+3+cmd|' /C calc'!A0"`);
  });

  it("leaves phone numbers and negative amounts readable", () => {
    const csv = toCsv(["phone", "amount"], [["+380 67 123 45 67", "-150.50"]]);
    expect(csv).toContain('"+380 67 123 45 67";"-150.50"');
  });
});

describe("csvResponse", () => {
  it("downloads as an uncached UTF-8 CSV file", () => {
    const res = csvResponse("kontakty.csv", "x");
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="kontakty.csv"');
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
