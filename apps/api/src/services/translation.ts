import {
  collectLocksForLanguage,
  enforceLockedKeywords,
  enforceLockedKeywordsOnPage,
  normalizePageSchema,
  transformPageSchema,
  type KeywordLock,
  type LanguageCode,
  type PageDocument,
  type PageSchema
} from "@seo-localization/shared";
import { config } from "../config.js";
import {
  applyJsonEntryTranslations,
  buildSchemaFromJsonDocument,
  collectTranslatableJsonEntries,
  transformJsonDocumentStrings
} from "./json-document.js";
import { translateWithProvider } from "./provider-translation.js";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

export function buildTranslationPrompt(
  page: PageSchema,
  targetLanguage: LanguageCode,
  locks: KeywordLock[]
): string {
  const languageName = languageNames.of(targetLanguage) ?? targetLanguage;
  const relevantLocks = collectLocksForLanguage(locks, targetLanguage);
  const lockInstructions = relevantLocks.length
    ? `Locked keywords:\n${relevantLocks
        .map(
          (lock) =>
            `- "${lock.sourceKeyword}" must become "${lock.targetKeyword}" in ${languageName}`
        )
        .join("\n")}\n`
    : "";

  return `Translate the following SEO page into ${languageName}.

Requirements:

- keep headings structure
- maintain SEO intent
- use locked keywords when provided
- keep natural search phrasing
- keep markdown structure
- keep the slug unchanged
- return JSON only with this exact shape:
  {
    "slug": string,
    "title": string,
    "description": string,
    "h1": string,
    "sections": [{ "heading": string, "content": string }],
    "faq": [{ "question": string, "answer": string }]
  }

${lockInstructions}Content:
${JSON.stringify(page, null, 2)}`;
}

export function buildJsonDocumentTranslationPrompt(
  document: PageDocument,
  targetLanguage: LanguageCode,
  locks: KeywordLock[]
): string {
  const languageName = languageNames.of(targetLanguage) ?? targetLanguage;
  const relevantLocks = collectLocksForLanguage(locks, targetLanguage);
  const lockInstructions = relevantLocks.length
    ? `Locked keywords:\n${relevantLocks
        .map(
          (lock) =>
            `- "${lock.sourceKeyword}" must become "${lock.targetKeyword}" in ${languageName}`
        )
        .join("\n")}\n`
    : "";
  const entries = collectTranslatableJsonEntries(document.value);

  return `Translate the listed string values from the following JSON document into ${languageName}.

Requirements:

- translate only the listed string values
- preserve JSON keys, nesting, arrays, ids, urls, slugs, and any non-listed values
- keep SEO and product intent natural in ${languageName}
- use locked keywords when provided
- return JSON only with this exact shape:
  {
    "translations": [{ "path": string, "value": string }]
  }
- include every listed path exactly once

${lockInstructions}Source JSON document:
${JSON.stringify(document.value, null, 2)}

String values to translate:
${JSON.stringify(entries, null, 2)}`;
}

export async function translatePageSchema(
  page: PageSchema,
  targetLanguage: LanguageCode,
  keywordLocks: KeywordLock[]
): Promise<PageSchema> {
  if (config.translationProvider !== "mock") {
    const prompt = buildTranslationPrompt(page, targetLanguage, keywordLocks);
    const outputText = await translateWithProvider(prompt);
    const parsed = parseTranslatedSchema(outputText, page.slug);
    return enforceLockedKeywordsOnPage(parsed, collectLocksForLanguage(keywordLocks, targetLanguage));
  }

  const locks = collectLocksForLanguage(keywordLocks, targetLanguage);
  const languageName = languageNames.of(targetLanguage) ?? targetLanguage;

  const translated = transformPageSchema(page, (value, field) => {
    if (!value.trim()) {
      return value;
    }

    if (field === "title" || field === "h1") {
      return `${value} (${languageName})`;
    }

    return `[${targetLanguage}] ${value}`;
  });

  return enforceLockedKeywordsOnPage(translated, locks);
}

export async function translateJsonDocument(
  document: PageDocument,
  filePath: string,
  targetLanguage: LanguageCode,
  keywordLocks: KeywordLock[]
): Promise<{ document: PageDocument; schema: PageSchema; prompt: string }> {
  const locks = collectLocksForLanguage(keywordLocks, targetLanguage);
  const prompt = buildJsonDocumentTranslationPrompt(document, targetLanguage, keywordLocks);

  if (config.translationProvider === "mock") {
    const languageName = languageNames.of(targetLanguage) ?? targetLanguage;
    const translatedValue = transformJsonDocumentStrings(document.value, (value) => {
      if (!value.trim()) {
        return value;
      }

      return enforceLockedKeywords(`[${languageName}] ${value}`, locks);
    });
    const translatedDocument: PageDocument = {
      kind: "json",
      value: translatedValue
    };

    return {
      prompt,
      document: translatedDocument,
      schema: enforceLockedKeywordsOnPage(buildSchemaFromJsonDocument(filePath, translatedValue), locks)
    };
  }

  const outputText = await translateWithProvider(prompt);
  const translations = parseJsonDocumentTranslations(outputText);
  const translatedValue = applyJsonEntryTranslations(
    document.value,
    translations.map((entry) => ({
      path: entry.path,
      value: enforceLockedKeywords(entry.value, locks)
    }))
  );
  const translatedDocument: PageDocument = {
    kind: "json",
    value: translatedValue
  };

  return {
    prompt,
    document: translatedDocument,
    schema: enforceLockedKeywordsOnPage(buildSchemaFromJsonDocument(filePath, translatedValue), locks)
  };
}

function parseTranslatedSchema(raw: string, originalSlug: string): PageSchema {
  const candidate = extractJsonObject(raw);
  const value = JSON.parse(candidate) as Partial<PageSchema>;

  if (
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.h1 !== "string" ||
    !Array.isArray(value.sections) ||
    !Array.isArray(value.faq)
  ) {
    throw new Error("Translated schema is missing required fields.");
  }

  return normalizePageSchema({
    slug: originalSlug,
    title: value.title,
    description: value.description,
    h1: value.h1,
    sections: value.sections.map((section) => ({
      heading: String(section.heading ?? ""),
      content: String(section.content ?? "")
    })),
    faq: value.faq.map((item) => ({
      question: String(item.question ?? ""),
      answer: String(item.answer ?? "")
    }))
  });
}

function parseJsonDocumentTranslations(raw: string): Array<{ path: string; value: string }> {
  const candidate = extractJsonObject(raw);
  const value = JSON.parse(candidate) as {
    translations?: Array<{ path?: string; value?: string }>;
  };

  if (!Array.isArray(value.translations)) {
    throw new Error("Translated JSON document is missing the translations array.");
  }

  const entries = value.translations
    .filter((entry) => typeof entry?.path === "string" && typeof entry?.value === "string")
    .map((entry) => ({
      path: String(entry.path),
      value: String(entry.value)
    }));

  if (!entries.length) {
    throw new Error("Translated JSON document did not include any translated entries.");
  }

  return entries;
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Translation response did not contain a JSON object.");
  }

  return trimmed.slice(start, end + 1);
}
