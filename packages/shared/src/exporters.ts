import { buildHreflangEntries, renderHreflangJson } from "./hreflang";
import { renderPageHtml, renderPageMarkdown } from "./page-schema";
import { renderSitemapDocument } from "./sitemap";
import type {
  ExportFormat,
  GeneratedPageFile,
  PageExportBundle,
  PageRecord,
  Project
} from "./types";

export function buildExportBundle(
  project: Project,
  page: PageRecord,
  formats: ExportFormat[] = ["json"]
): PageExportBundle {
  const availableLanguages = [
    project.sourceLanguage,
    ...project.targetLanguages.filter(
      (language) => Boolean(page.translations[language] || page.documentTranslations?.[language])
    )
  ];
  const hreflang = buildHreflangEntries(project.baseUrl, page.schema.slug, availableLanguages);
  const files: GeneratedPageFile[] = [];

  for (const language of availableLanguages) {
    const schema = language === project.sourceLanguage ? page.schema : page.translations[language];
    if (!schema) {
      continue;
    }

    for (const format of formats) {
      files.push({
        language,
        format,
        path: `${language}.${extensionFor(format)}`,
        content: renderFile(format, page, schema, language, project.sourceLanguage)
      });
    }
  }

  files.push({
    language: "global",
    format: "json",
    path: "hreflang.json",
    content: renderHreflangJson(hreflang)
  });

  const sitemapByLanguage = Object.fromEntries(
    availableLanguages.map((language) => {
      const currentUrl = `${project.baseUrl.replace(/\/$/, "")}/${language}/${page.schema.slug}`;
      return [language, renderSitemapDocument(currentUrl, hreflang)];
    })
  );

  return {
    projectId: project.id,
    pageId: page.id,
    slug: page.schema.slug,
    generatedAt: new Date().toISOString(),
    files,
    hreflang,
    sitemapByLanguage
  };
}

function extensionFor(format: ExportFormat): string {
  switch (format) {
    case "markdown":
      return "md";
    case "json":
      return "json";
    case "html":
      return "html";
  }
}

function renderFile(
  format: ExportFormat,
  page: PageRecord,
  schema: PageRecord["schema"],
  language: string,
  sourceLanguage: string
): string {
  switch (format) {
    case "markdown":
      return renderPageMarkdown(schema);
    case "json":
      return JSON.stringify(resolveDocument(page, language, sourceLanguage) ?? schema, null, 2);
    case "html":
      return renderPageHtml(schema, language);
  }
}

function resolveDocument(page: PageRecord, language: string, sourceLanguage: string): unknown | undefined {
  if (language === sourceLanguage) {
    return page.sourceDocument?.value;
  }

  return page.documentTranslations?.[language]?.value;
}
