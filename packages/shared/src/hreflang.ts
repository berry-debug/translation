import type { HreflangEntry, LanguageCode } from "./types";

export function buildLocalizedPath(language: LanguageCode, slug: string): string {
  return `/${language}/${slug}`;
}

export function buildHreflangEntries(
  baseUrl: string,
  slug: string,
  languages: LanguageCode[]
): HreflangEntry[] {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return languages.map((language) => ({
    hreflang: language,
    href: `${normalizedBaseUrl}${buildLocalizedPath(language, slug)}`
  }));
}

export function renderHreflangJson(entries: HreflangEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

