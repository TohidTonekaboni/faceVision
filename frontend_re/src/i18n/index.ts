import { EN } from "./en";
import { FA } from "./fa";
import type { Dict } from "./en";

export type Lang = "en" | "fa";

export const DICTS: Record<Lang, Dict> = { en: EN, fa: FA };

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Maps Latin digits to Persian digits when lang is "fa"; matches the source's `fd`. */
export function formatDigits(lang: Lang, value: string | number): string {
  const s = String(value);
  return lang === "fa" ? s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]) : s;
}

export function t(lang: Lang): Dict {
  return DICTS[lang];
}
