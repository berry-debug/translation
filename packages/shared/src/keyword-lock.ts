import type { KeywordLock, LanguageCode, PageSchema } from "./types";
import { transformPageSchema } from "./page-schema";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function collectLocksForLanguage(
  locks: KeywordLock[],
  targetLanguage: LanguageCode
): KeywordLock[] {
  return locks.filter((lock) => lock.targetLanguage === targetLanguage);
}

export function enforceLockedKeywords(
  value: string,
  locks: KeywordLock[]
): string {
  return locks.reduce((current, lock) => {
    const pattern = new RegExp(escapeRegExp(lock.sourceKeyword), "gi");
    return current.replace(pattern, lock.targetKeyword);
  }, value);
}

export function enforceLockedKeywordsOnPage(
  page: PageSchema,
  locks: KeywordLock[]
): PageSchema {
  return transformPageSchema(page, (value) => enforceLockedKeywords(value, locks));
}

