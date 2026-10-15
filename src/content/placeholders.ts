import { isPlaceholder } from "./site";

/** Every string under `value` that still contains a «…» placeholder, as "path: text". */
export function placeholders(value: unknown, path = ""): string[] {
  if (typeof value === "string") return isPlaceholder(value) ? [`${path}: ${value}`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => placeholders(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => placeholders(v, path ? `${path}.${k}` : k));
  }
  return [];
}
