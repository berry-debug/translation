import { randomUUID } from "node:crypto";
import type {
  DashboardOverview,
  ExportFormat,
  KeywordLock,
  PageDocument,
  PageExportBundle,
  PageRecord,
  PageSchema,
  PageSourceReference,
  Project
} from "@seo-localization/shared";
import fs from "node:fs";
import path from "node:path";
import { writeBundleToDirectory } from "../services/export-writer.js";

interface CreateProjectInput {
  name: string;
  sourceLanguage: string;
  targetLanguages: string[];
  baseUrl: string;
}

interface DefaultProjectOptions {
  name: string;
  sourceLanguage: string;
  targetLanguages: string[];
  baseUrl: string;
}

interface CreatePageInput {
  projectId: string;
  sourceLanguage: string;
  rawContent?: string;
  sourceReference?: PageSourceReference;
  extractedTextBlocks?: string[];
  sourceDocument?: PageDocument;
  schema: PageSchema;
}

interface CreateKeywordLockInput {
  projectId: string;
  sourceKeyword: string;
  targetLanguage: string;
  targetKeyword: string;
}

interface StoreState {
  projects: Project[];
  pages: PageRecord[];
  keywordLocks: KeywordLock[];
  exports: PageExportBundle[];
}

export class InMemoryStore {
  private readonly projects = new Map<string, Project>();
  private readonly pages = new Map<string, PageRecord>();
  private readonly keywordLocks = new Map<string, KeywordLock>();
  private readonly exports = new Map<string, PageExportBundle[]>();
  private readonly stateFile?: string;
  private readonly exportRoot?: string;
  private readonly defaultProject?: DefaultProjectOptions;

  constructor(options?: { stateFile?: string; exportRoot?: string; defaultProject?: DefaultProjectOptions }) {
    this.stateFile = options?.stateFile;
    this.exportRoot = options?.exportRoot;
    this.defaultProject = options?.defaultProject;

    const state = this.loadState();
    if (state) {
      for (const project of state.projects) {
        this.projects.set(project.id, project);
      }

      for (const page of state.pages) {
        this.pages.set(page.id, page);
      }

      for (const lock of state.keywordLocks) {
        this.keywordLocks.set(lock.id, lock);
      }

      for (const bundle of state.exports) {
        const current = this.exports.get(bundle.projectId) ?? [];
        current.push(bundle);
        this.exports.set(bundle.projectId, current);
      }
    }

    if (this.defaultProject) {
      this.ensureDefaultProject(this.defaultProject);
    }
  }

  ensureDefaultProject(input: DefaultProjectOptions): Project {
    const existing = [...this.projects.values()][0];
    if (existing) {
      const normalized: Project = {
        ...existing,
        name: input.name,
        sourceLanguage: input.sourceLanguage,
        targetLanguages: [...new Set(input.targetLanguages.map((language) => language.toLowerCase()))].filter(
          (language) => language !== input.sourceLanguage
        ),
        baseUrl: input.baseUrl.replace(/\/$/, "")
      };
      this.projects.clear();
      this.projects.set(normalized.id, normalized);
      this.persist();
      return normalized;
    }

    return this.createProject(input);
  }

  getOverview(): DashboardOverview {
    const pages = this.listPages();
    const languageSet = new Set<string>();

    for (const project of this.projects.values()) {
      languageSet.add(project.sourceLanguage);
      for (const language of project.targetLanguages) {
        languageSet.add(language);
      }
    }

    return {
      projectCount: this.projects.size,
      pageCount: pages.length,
      languageCount: languageSet.size,
      translatedPageCount: pages.filter((page) => Object.keys(page.translations).length > 0).length,
      queuedJobs: 0
    };
  }

  listProjects(): Project[] {
    return [...this.projects.values()];
  }

  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }

  createProject(input: CreateProjectInput): Project {
    const sourceLanguage = (input.sourceLanguage || "en").toLowerCase();
    const targetLanguages = [...new Set(input.targetLanguages.map((language) => language.toLowerCase()))].filter(
      (language) => language !== sourceLanguage
    );

    const existing = [...this.projects.values()][0];
    const project: Project = existing
      ? {
          ...existing,
          name: input.name,
          sourceLanguage,
          targetLanguages,
          baseUrl: input.baseUrl.replace(/\/$/, "")
        }
      : {
          id: randomUUID(),
          name: input.name,
          sourceLanguage,
          targetLanguages,
          baseUrl: input.baseUrl.replace(/\/$/, ""),
          createdAt: new Date().toISOString()
        };

    this.projects.set(project.id, project);
    this.persist();
    return project;
  }

  listPages(projectId?: string): PageRecord[] {
    return [...this.pages.values()].filter((page) => !projectId || page.projectId === projectId);
  }

  getPage(pageId: string): PageRecord | undefined {
    return this.pages.get(pageId);
  }

  createPage(input: CreatePageInput): PageRecord {
    const existing = input.sourceReference ? this.findPageBySource(input.projectId, input.sourceReference) : undefined;
    if (existing) {
      const updated: PageRecord = {
        ...existing,
        rawContent: input.rawContent,
        sourceReference: input.sourceReference,
        extractedTextBlocks: input.extractedTextBlocks,
        sourceDocument: input.sourceDocument,
        schema: input.schema,
        translations: {},
        documentTranslations: {},
        status: "parsed",
        updatedAt: new Date().toISOString()
      };

      this.pages.set(existing.id, updated);
      this.persist();
      return updated;
    }

    const page: PageRecord = {
      id: randomUUID(),
      projectId: input.projectId,
      sourceLanguage: input.sourceLanguage,
      rawContent: input.rawContent,
      sourceReference: input.sourceReference,
      extractedTextBlocks: input.extractedTextBlocks,
      sourceDocument: input.sourceDocument,
      schema: input.schema,
      translations: {},
      documentTranslations: {},
      status: "parsed",
      updatedAt: new Date().toISOString()
    };

    this.pages.set(page.id, page);
    this.persist();
    return page;
  }

  saveTranslation(pageId: string, language: string, schema: PageSchema, document?: PageDocument): PageRecord {
    const existing = this.pages.get(pageId);
    if (!existing) {
      throw new Error(`Page ${pageId} not found.`);
    }

    const updated: PageRecord = {
      ...existing,
      translations: {
        ...existing.translations,
        [language]: schema
      },
      documentTranslations: document
        ? {
            ...(existing.documentTranslations ?? {}),
            [language]: document
          }
        : existing.documentTranslations,
      status: "translated",
      updatedAt: new Date().toISOString()
    };

    this.pages.set(pageId, updated);
    this.persist();
    return updated;
  }

  saveSourcePage(pageId: string, schema: PageSchema, sourceDocument?: PageDocument, extractedTextBlocks?: string[]): PageRecord {
    const existing = this.pages.get(pageId);
    if (!existing) {
      throw new Error(`Page ${pageId} not found.`);
    }

    const updated: PageRecord = {
      ...existing,
      extractedTextBlocks: extractedTextBlocks ?? existing.extractedTextBlocks,
      sourceDocument: sourceDocument ?? existing.sourceDocument,
      schema,
      translations: {},
      documentTranslations: {},
      status: "parsed",
      updatedAt: new Date().toISOString()
    };

    this.pages.set(pageId, updated);
    this.persist();
    return updated;
  }

  deletePage(pageId: string): boolean {
    const page = this.pages.get(pageId);
    if (!page) {
      return false;
    }

    this.pages.delete(pageId);

    const currentExports = this.exports.get(page.projectId);
    if (currentExports) {
      this.exports.set(
        page.projectId,
        currentExports.filter((bundle) => bundle.pageId !== pageId)
      );
    }

    this.persist();
    return true;
  }

  clearProjectPages(projectId: string): number {
    const projectPages = this.listPages(projectId);
    for (const page of projectPages) {
      this.pages.delete(page.id);
    }

    this.exports.delete(projectId);
    this.persist();
    return projectPages.length;
  }

  listKeywordLocks(projectId?: string): KeywordLock[] {
    return [...this.keywordLocks.values()].filter((lock) => !projectId || lock.projectId === projectId);
  }

  createKeywordLock(input: CreateKeywordLockInput): KeywordLock {
    const lock: KeywordLock = {
      id: randomUUID(),
      projectId: input.projectId,
      sourceKeyword: input.sourceKeyword,
      targetLanguage: input.targetLanguage,
      targetKeyword: input.targetKeyword
    };

    this.keywordLocks.set(lock.id, lock);
    this.persist();
    return lock;
  }

  saveExport(bundle: PageExportBundle): PageExportBundle {
    const outputRoot = this.writeExportBundle(bundle);
    const storedBundle: PageExportBundle = {
      ...bundle,
      outputRoot
    };

    const current = this.exports.get(bundle.projectId) ?? [];
    const filtered = current.filter((item) => item.pageId !== bundle.pageId);
    filtered.push(storedBundle);
    this.exports.set(bundle.projectId, filtered);

    const page = this.getPage(bundle.pageId);
    if (page) {
      this.pages.set(bundle.pageId, {
        ...page,
        status: "exported",
        updatedAt: new Date().toISOString()
      });
    }

    this.persist();
    return storedBundle;
  }

  listExports(projectId: string): PageExportBundle[] {
    return this.exports.get(projectId) ?? [];
  }

  private loadState(): StoreState | undefined {
    if (!this.stateFile || !fs.existsSync(this.stateFile)) {
      return undefined;
    }

    const content = fs.readFileSync(this.stateFile, "utf8");
    return JSON.parse(content) as StoreState;
  }

  private persist(): void {
    if (!this.stateFile) {
      return;
    }

    const state: StoreState = {
      projects: this.listProjects(),
      pages: this.listPages(),
      keywordLocks: this.listKeywordLocks(),
      exports: [...this.exports.values()].flat()
    };

    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    const nextFile = `${this.stateFile}.tmp`;
    fs.writeFileSync(nextFile, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(nextFile, this.stateFile);
  }

  private writeExportBundle(bundle: PageExportBundle): string | undefined {
    if (!this.exportRoot) {
      return undefined;
    }

    const outputRoot = path.join(this.exportRoot, bundle.projectId, bundle.slug);
    return writeBundleToDirectory(bundle, outputRoot);
  }

  private findPageBySource(projectId: string, sourceReference: PageSourceReference): PageRecord | undefined {
    const signature = this.buildSourceSignature(sourceReference);
    if (!signature) {
      return undefined;
    }

    return this.listPages(projectId).find((page) => this.buildSourceSignature(page.sourceReference) === signature);
  }

  private buildSourceSignature(sourceReference?: PageSourceReference): string | undefined {
    if (!sourceReference) {
      return undefined;
    }

    return [
      sourceReference.kind,
      sourceReference.repoUrl ?? "",
      sourceReference.branch ?? "",
      sourceReference.rootPath ?? "",
      sourceReference.relativePath ?? "",
      sourceReference.label
    ].join("::");
  }
}

export const defaultExportFormats: ExportFormat[] = ["json"];
