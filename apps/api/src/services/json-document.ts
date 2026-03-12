import path from "node:path";
import {
  normalizePageSchema,
  slugify,
  type PageDocument,
  type PageSchema
} from "@seo-localization/shared";

export interface JsonDocumentStringEntry {
  path: string;
  value: string;
  propertyName?: string;
}

const visiblePropertyNames = new Set([
  "title",
  "description",
  "subtitle",
  "heading",
  "headline",
  "label",
  "text",
  "content",
  "message",
  "paragraph",
  "summary",
  "excerpt",
  "intro",
  "placeholder",
  "helpertext",
  "helptext",
  "emptytext",
  "caption",
  "alt",
  "arialabel",
  "tooltip",
  "question",
  "answer",
  "cta",
  "buttontext",
  "confirmtext",
  "canceltext",
  "oktext",
  "successmessage",
  "errormessage",
  "one_liner",
  "section_cta",
  "micro_cta",
  "button_label",
  "subheading"
]);

const skippedTranslationPropertyNames = new Set([
  "id",
  "slug",
  "url",
  "src",
  "href",
  "path",
  "feedid",
  "defaultstyleid",
  "canonical",
  "imageurl",
  "imageurl1",
  "imageurl2",
  "imageurl3",
  "imageurl4",
  "imageurl5",
  "imageurl6",
  "imageurl7",
  "imageurl8",
  "coverimage",
  "coverimageurl"
]);

const preferredSlugProperties = new Set(["slug"]);
const preferredTitleProperties = new Set(["title", "headline", "heading", "name"]);
const preferredDescriptionProperties = new Set(["description", "summary", "subtitle", "excerpt", "paragraph", "intro"]);
const preferredH1Properties = new Set(["h1", "headline", "title", "heading"]);

export function parseJsonDocument(content: string): PageDocument | undefined {
  try {
    return {
      kind: "json",
      value: JSON.parse(content) as unknown
    };
  } catch {
    return undefined;
  }
}

export function extractJsonTextBlocks(document: unknown): string[] {
  const collector: string[] = [];
  collectJsonStrings(document, collector);
  return dedupeStrings(collector.filter(isProbablyDisplayText)).slice(0, 160);
}

export function collectTranslatableJsonEntries(document: unknown): JsonDocumentStringEntry[] {
  const collector: JsonDocumentStringEntry[] = [];
  collectTranslatableEntries(document, collector, "", undefined);
  return collector;
}

export function transformJsonDocumentStrings(
  document: unknown,
  mapper: (value: string, path: string, propertyName?: string) => string
): unknown {
  if (typeof document === "string") {
    return mapper(document, "", undefined);
  }

  if (Array.isArray(document)) {
    return document.map((item, index) => transformJsonNode(item, mapper, `/${index}`, undefined));
  }

  if (document && typeof document === "object") {
    return transformJsonNode(document, mapper, "", undefined);
  }

  return document;
}

export function applyJsonEntryTranslations(
  document: unknown,
  translatedEntries: Array<{ path: string; value: string }>
): unknown {
  const next = cloneJsonValue(document);
  const translationMap = new Map(translatedEntries.map((entry) => [entry.path, entry.value]));

  for (const entry of collectTranslatableJsonEntries(next)) {
    const translatedValue = translationMap.get(entry.path);
    if (typeof translatedValue !== "string") {
      continue;
    }
    assignJsonPointerValue(next, entry.path, translatedValue);
  }

  return next;
}

export function buildSchemaFromJsonDocument(filePath: string, document: unknown): PageSchema {
  const extractedTextBlocks = extractJsonTextBlocks(document);
  const slugSource = findFirstStringByProperty(document, preferredSlugProperties) ?? humanizeFileName(filePath);
  const title =
    findFirstStringByProperty(document, preferredTitleProperties) ??
    extractedTextBlocks[0] ??
    humanizeFileName(filePath);
  const description =
    findFirstStringByProperty(document, preferredDescriptionProperties) ??
    extractedTextBlocks.find((value) => value !== title) ??
    title;
  const h1 =
    findFirstStringByProperty(document, preferredH1Properties) ??
    title;

  const usedValues = new Set([title, description, h1].map((value) => value.trim().toLowerCase()));
  const sectionEntries = collectTranslatableJsonEntries(document)
    .filter((entry) => !usedValues.has(entry.value.trim().toLowerCase()))
    .slice(0, 24);

  const sections = sectionEntries.length
    ? sectionEntries.map((entry, index) => ({
        heading: index === 0 ? "页面标题" : humanizePropertyName(entry.propertyName, index),
        content: cleanInlineText(entry.value)
      }))
    : extractedTextBlocks.slice(0, 24).map((text, index) => ({
        heading: index === 0 ? "页面标题" : `文案 ${index}`,
        content: text
      }));

  return normalizePageSchema({
    slug: slugify(slugSource),
    title,
    description: description.slice(0, 320),
    h1,
    sections,
    faq: []
  });
}

function transformJsonNode(
  value: unknown,
  mapper: (value: string, path: string, propertyName?: string) => string,
  currentPath: string,
  propertyName?: string
): unknown {
  if (typeof value === "string") {
    return shouldTranslateString(value, propertyName) ? mapper(value, currentPath, propertyName) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => transformJsonNode(item, mapper, `${currentPath}/${index}`, propertyName));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        transformJsonNode(nestedValue, mapper, `${currentPath}/${escapeJsonPointerSegment(key)}`, key)
      ])
    );
  }

  return value;
}

function collectJsonStrings(value: unknown, collector: string[], propertyName?: string): void {
  if (typeof value === "string") {
    const normalizedPropertyName = normalizePropertyName(propertyName);
    if (!propertyName || visiblePropertyNames.has(normalizedPropertyName) || isProbablyDisplayText(value)) {
      collector.push(cleanInlineText(value));
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonStrings(item, collector, propertyName);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      collectJsonStrings(nestedValue, collector, key);
    }
  }
}

function collectTranslatableEntries(
  value: unknown,
  collector: JsonDocumentStringEntry[],
  currentPath: string,
  propertyName?: string
): void {
  if (typeof value === "string") {
    if (shouldTranslateString(value, propertyName)) {
      collector.push({
        path: currentPath,
        value,
        propertyName
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectTranslatableEntries(item, collector, `${currentPath}/${index}`, propertyName);
    });
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nestedValue]) => {
      collectTranslatableEntries(nestedValue, collector, `${currentPath}/${escapeJsonPointerSegment(key)}`, key);
    });
  }
}

function assignJsonPointerValue(document: unknown, pointer: string, value: string): void {
  if (!pointer) {
    return;
  }

  const segments = pointer
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = document;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];

    if (Array.isArray(current)) {
      current = current[Number(segment)];
      continue;
    }

    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return;
  }

  const leaf = segments[segments.length - 1];
  if (Array.isArray(current)) {
    current[Number(leaf)] = value;
    return;
  }

  if (current && typeof current === "object") {
    (current as Record<string, unknown>)[leaf] = value;
  }
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function shouldTranslateString(value: string, propertyName?: string): boolean {
  const cleaned = cleanInlineText(value);
  if (!cleaned) {
    return false;
  }

  const normalizedPropertyName = normalizePropertyName(propertyName);
  if (normalizedPropertyName && skippedTranslationPropertyNames.has(normalizedPropertyName)) {
    return false;
  }

  if (/^https?:\/\//i.test(cleaned)) {
    return false;
  }

  if (/^(data|mailto|tel):/i.test(cleaned)) {
    return false;
  }

  if (/^[./#@A-Za-z0-9_-]+$/.test(cleaned) && !/\s/.test(cleaned)) {
    return false;
  }

  if (!/[A-Za-z\u4e00-\u9fff]/.test(cleaned)) {
    return false;
  }

  if (cleaned.length > 4000) {
    return false;
  }

  return true;
}

function findFirstStringByProperty(value: unknown, propertyNames: Set<string>, propertyName?: string): string | undefined {
  if (typeof value === "string") {
    return propertyName && propertyNames.has(normalizePropertyName(propertyName)) ? cleanInlineText(value) : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringByProperty(item, propertyNames, propertyName);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const found = findFirstStringByProperty(nestedValue, propertyNames, key);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function normalizePropertyName(value?: string): string {
  return (value ?? "").replace(/[-_\s]/g, "").toLowerCase();
}

function escapeJsonPointerSegment(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function cleanInlineText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isProbablyDisplayText(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 4000) {
    return false;
  }

  if (!/[A-Za-z\u4e00-\u9fff]/.test(cleaned)) {
    return false;
  }

  if (/^https?:\/\//i.test(cleaned)) {
    return false;
  }

  return true;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function humanizeFileName(filePath: string): string {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizePropertyName(propertyName: string | undefined, index: number): string {
  if (!propertyName) {
    return `文案 ${index}`;
  }

  return propertyName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
