// CSV for Excel/Google Sheets: BOM so Excel reads UTF-8 Cyrillic, quoted fields, and a leading
// apostrophe on values that would otherwise be run as formulas (CSV injection).
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    // Plain phone numbers / amounts like "+380 67 123 45 67" are safe and stay as they are.
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-][\d\s().-]+$/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
