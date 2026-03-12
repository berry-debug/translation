export type LanguageCode = string;

export type PageStatus = "draft" | "parsed" | "translated" | "exported";

export type ExportFormat = "markdown" | "json" | "html";

export type PageSourceKind = "manual" | "upload" | "folder" | "git";

export interface PageSection {
  heading: string;
  content: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PageSchema {
  slug: string;
  title: string;
  description: string;
  h1: string;
  sections: PageSection[];
  faq: FaqItem[];
}

export interface PageDocument {
  kind: "json";
  value: unknown;
}

export interface Project {
  id: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguages: LanguageCode[];
  baseUrl: string;
  createdAt: string;
}

export interface PageSourceReference {
  kind: PageSourceKind;
  label: string;
  rootPath?: string;
  absolutePath?: string;
  relativePath?: string;
  repoUrl?: string;
  branch?: string;
}

export interface PageRecord {
  id: string;
  projectId: string;
  sourceLanguage: LanguageCode;
  rawContent?: string;
  sourceReference?: PageSourceReference;
  extractedTextBlocks?: string[];
  sourceDocument?: PageDocument;
  schema: PageSchema;
  translations: Record<LanguageCode, PageSchema>;
  documentTranslations?: Record<LanguageCode, PageDocument>;
  status: PageStatus;
  updatedAt: string;
}

export interface KeywordLock {
  id: string;
  projectId: string;
  sourceKeyword: string;
  targetLanguage: LanguageCode;
  targetKeyword: string;
}

export interface GeneratedPageFile {
  language: LanguageCode;
  format: ExportFormat;
  path: string;
  content: string;
}

export interface HreflangEntry {
  hreflang: LanguageCode;
  href: string;
}

export interface PageExportBundle {
  projectId: string;
  pageId: string;
  slug: string;
  generatedAt: string;
  outputRoot?: string;
  files: GeneratedPageFile[];
  hreflang: HreflangEntry[];
  sitemapByLanguage: Record<LanguageCode, string>;
}

export interface DashboardOverview {
  projectCount: number;
  pageCount: number;
  languageCount: number;
  translatedPageCount: number;
  queuedJobs: number;
}

export interface SystemStatus {
  translationProvider: string;
  apiKeyConfigured: boolean;
  model: string;
  apiBaseUrl: string;
  canTranslate: boolean;
  configFile: string;
  exportRoot: string;
  stateFile: string;
}

export interface TranslationRequest {
  pageId: string;
  targetLanguage: LanguageCode;
}

export interface GenerateProjectRequest {
  formats?: ExportFormat[];
}
