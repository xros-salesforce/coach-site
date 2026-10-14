// Ukrainian → Latin per the official 2010 transliteration (КМУ №55), used for event URLs.
// Є, Ї, Й, Ю, Я are spelled differently at the start of a word.
const map: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i",
  ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia",
};
const wordStart: Record<string, string> = { є: "ye", ї: "yi", й: "y", ю: "yu", я: "ya" };

export function slugify(text: string) {
  const lower = text.toLowerCase().replace(/[’'`ʼ]/g, "").replace(/зг/g, "zgh");
  let out = "";
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const atWordStart = i === 0 || !/[\p{L}\d]/u.test(lower[i - 1]);
    out += (atWordStart && wordStart[ch]) || (map[ch] ?? ch);
  }
  return out
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}
