"use client";

import {
  renderPageMarkdown,
  type KeywordLock,
  type PageRecord,
  type PageSchema,
  type Project,
  type SystemStatus
} from "@seo-localization/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import {
  clearProjectPages,
  createPage,
  deletePage,
  importFiles,
  importFolder,
  importGitRepository,
  runProject,
  saveProjectExports,
  saveTranslation,
  translatePage,
  translatePageAll
} from "../lib/api-actions";
import { clonePageSchema } from "./workflow/draft-utils";
import { ReviewLanguageModal } from "./workflow/review-language-modal";
import {
  EmptyState,
  Field,
  LanguageReviewCard,
  PrimaryButton,
  SchemaPreviewCard,
  SecondaryButton,
  SelectField
} from "./workflow/workflow-primitives";

type WorkflowStep = "import" | "translate" | "edit" | "export";
type ImportMode = "git" | "folder" | "upload" | "manual";

interface WorkflowWorkspaceProps {
  projects: Project[];
  pages: PageRecord[];
  locks: KeywordLock[];
  systemStatus: SystemStatus;
  initialStep?: WorkflowStep;
  initialPageId?: string;
}

interface UploadDraftFile {
  name: string;
  relativePath?: string;
  content: string;
}

interface ImportResponse {
  importedCount: number;
  skippedCount: number;
  skipped: Array<{ path: string; reason: string }>;
  pages?: Array<{ id: string; schema: { title: string; slug: string } }>;
}

interface LanguageReviewItem {
  language: string;
  translation?: PageSchema;
  hasTranslation: boolean;
}

const sampleTemplate = `---
title: AI Interior Design
description: Generate professional interior design with AI.
---

# AI Interior Design

## How AI Interior Design Works

Upload your room photo and generate design ideas instantly.

## Why This Page Converts

It keeps the content concise, searchable, and easy to localize.

## FAQ

### Is AI Interior Design good for SEO pages?

Yes. It keeps page structure stable while translating into multiple languages.`;

const importModes: Array<{ id: ImportMode; label: string; hint: string }> = [
  { id: "git", label: "Git 地址", hint: "直接克隆仓库并扫描 KusaPics 代码" },
  { id: "folder", label: "本地目录", hint: "输入本地项目路径，让后端递归读取" },
  { id: "upload", label: "上传文件", hint: "拖拽或选择代码文件，快速做一次扫描" },
  { id: "manual", label: "手动粘贴", hint: "只作为兜底入口，不建议日常使用" }
];

const steps: Array<{ id: WorkflowStep; title: string; description: string }> = [
  { id: "import", title: "接入代码", description: "导入 KusaPics 仓库、本地目录或文件。" },
  { id: "translate", title: "生成翻译", description: "为当前页面和语言生成第一版草稿。" },
  { id: "edit", title: "人工校对", description: "修改标题、描述、正文和 FAQ。" },
  { id: "export", title: "回写代码", description: "把当前结果写回目录或仓库工作树。" }
];

export function WorkflowWorkspace({
  projects,
  pages,
  locks,
  systemStatus,
  initialStep,
  initialPageId
}: WorkflowWorkspaceProps) {
  const router = useRouter();
  const selectedProject = projects[0];
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(initialStep ?? (pages.length ? "translate" : "import"));
  const [selectedPageId, setSelectedPageId] = useState(initialPageId ?? pages[0]?.id ?? "");
  const [selectedLanguage, setSelectedLanguage] = useState(projects[0]?.targetLanguages[0] ?? "");
  const [batchLanguages, setBatchLanguages] = useState<string[]>(projects[0]?.targetLanguages ?? []);
  const [importMode, setImportMode] = useState<ImportMode>("git");
  const [content, setContent] = useState(sampleTemplate);
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [folderPath, setFolderPath] = useState("");
  const [uploadFiles, setUploadFiles] = useState<UploadDraftFile[]>([]);
  const [targetPath, setTargetPath] = useState("");
  const [jsonDraftText, setJsonDraftText] = useState("");
  const [draft, setDraft] = useState<PageSchema | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<ImportResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [isClearingPages, setIsClearingPages] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [writtenRoots, setWrittenRoots] = useState<string[]>([]);
  const [locallySavedContextKey, setLocallySavedContextKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const projectPages = useMemo(
    () => pages.filter((page) => !selectedProject || page.projectId === selectedProject.id),
    [pages, selectedProject]
  );
  const selectedPage = useMemo(
    () => projectPages.find((page) => page.id === selectedPageId) ?? projectPages[0],
    [projectPages, selectedPageId]
  );

  const currentTranslation = selectedPage && selectedLanguage ? selectedPage.translations[selectedLanguage] : undefined;
  const currentDocumentTranslation = selectedPage?.documentTranslations?.[selectedLanguage];
  const languageReviewItems = useMemo<LanguageReviewItem[]>(
    () =>
      (selectedProject?.targetLanguages ?? []).map((language) => {
        const translation = selectedPage?.translations[language];
        return {
          language,
          translation,
          hasTranslation: Boolean(translation)
        };
      }),
    [selectedPage, selectedProject]
  );
  const isJsonDocumentPage = selectedPage?.sourceDocument?.kind === "json";
  const hasAnyTranslations = projectPages.some((page) => Object.keys(page.translations).length > 0);
  const selectedPageHasTranslations = languageReviewItems.some((item) => item.hasTranslation);
  const currentContextKey = `${selectedPage?.id ?? ""}:${selectedLanguage}`;
  const hasWritableTranslations = hasAnyTranslations || locallySavedContextKey === currentContextKey;
  const extractedCount = selectedPage?.extractedTextBlocks?.length ?? selectedPage?.schema.sections.length ?? 0;
  const batchTaskCount = projectPages.length * batchLanguages.length;
  const suggestedWritePath =
    selectedPage?.sourceReference?.rootPath ??
    selectedPage?.sourceReference?.absolutePath?.replace(/\/[^/]+$/, "") ??
    "";

  useEffect(() => {
    if (initialStep) {
      setCurrentStep(initialStep);
    }
  }, [initialStep]);

  useEffect(() => {
    if (initialPageId && projectPages.some((page) => page.id === initialPageId)) {
      setSelectedPageId(initialPageId);
    }
  }, [initialPageId, projectPages]);

  useEffect(() => {
    if (!projectPages.length) {
      if (selectedPageId) {
        setSelectedPageId("");
      }
      return;
    }

    if (!projectPages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(projectPages[0].id);
    }
  }, [projectPages, selectedPageId]);

  useEffect(() => {
    const availableLanguages = selectedProject?.targetLanguages ?? [];
    if (!availableLanguages.length) {
      setSelectedLanguage("");
      setBatchLanguages([]);
      return;
    }

    if (!availableLanguages.includes(selectedLanguage)) {
      setSelectedLanguage(availableLanguages[0]);
    }

    setBatchLanguages((current) => {
      const filtered = current.filter((language) => availableLanguages.includes(language));
      return filtered.length ? filtered : [...availableLanguages];
    });
  }, [selectedLanguage, selectedProject]);

  useEffect(() => {
    setDraft(currentTranslation ? clonePageSchema(currentTranslation) : null);
  }, [currentTranslation]);

  useEffect(() => {
    setJsonDraftText(currentDocumentTranslation ? JSON.stringify(currentDocumentTranslation.value, null, 2) : "");
  }, [currentDocumentTranslation]);

  useEffect(() => {
    setIsReviewModalOpen(false);
  }, [selectedPageId]);

  const enabledSteps = {
    import: true,
    translate: Boolean(selectedPage),
    edit: Boolean(selectedPage) && selectedPageHasTranslations,
    export: hasWritableTranslations
  } satisfies Record<WorkflowStep, boolean>;

  function refreshData() {
    startTransition(() => {
      router.refresh();
    });
  }

  function setSuccess(nextMessage: string) {
    setError(null);
    setMessage(nextMessage);
  }

  async function handleManualCreatePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject?.id || !content.trim()) {
      return;
    }

    setError(null);
    setMessage(null);
    setLastImport(null);
    setIsImporting(true);

    try {
      const page = (await createPage({
        projectId: selectedProject.id,
        content
      })) as PageRecord;
      setSelectedPageId(page.id);
      setCurrentStep("translate");
      setSuccess("源码内容已导入。下一步可以直接生成翻译。");
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "导入失败。");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleImportGit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject?.id || !gitUrl.trim()) {
      return;
    }

    setError(null);
    setMessage(null);
    setLastImport(null);
    setIsImporting(true);

    try {
      const response = (await importGitRepository({
        projectId: selectedProject.id,
        repoUrl: gitUrl.trim(),
        branch: gitBranch.trim() || undefined
      })) as ImportResponse;
      setLastImport(response);
      if (response.pages?.[0]?.id) {
        setSelectedPageId(response.pages[0].id);
      }
      setCurrentStep("translate");
      setSuccess(`已从 Git 仓库识别 ${response.importedCount} 个文案单元。`);
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Git 导入失败。");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleImportFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject?.id || !folderPath.trim()) {
      return;
    }

    setError(null);
    setMessage(null);
    setLastImport(null);
    setIsImporting(true);

    try {
      const response = (await importFolder({
        projectId: selectedProject.id,
        folderPath: folderPath.trim()
      })) as ImportResponse;
      setLastImport(response);
      if (response.pages?.[0]?.id) {
        setSelectedPageId(response.pages[0].id);
      }
      setCurrentStep("translate");
      setSuccess(`已从本地目录识别 ${response.importedCount} 个文案单元。`);
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "目录导入失败。");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleImportUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject?.id || !uploadFiles.length) {
      return;
    }

    setError(null);
    setMessage(null);
    setLastImport(null);
    setIsImporting(true);

    try {
      const response = (await importFiles({
        projectId: selectedProject.id,
        files: uploadFiles
      })) as ImportResponse;
      setLastImport(response);
      setUploadFiles([]);
      if (response.pages?.[0]?.id) {
        setSelectedPageId(response.pages[0].id);
      }
      setCurrentStep("translate");
      setSuccess(`已上传并识别 ${response.importedCount} 个文案单元。`);
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "文件导入失败。");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleFileSelection(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const nextFiles = await Promise.all(
      Array.from(files).map(async (file) => ({
        name: file.name,
        relativePath:
          "webkitRelativePath" in file && typeof file.webkitRelativePath === "string" && file.webkitRelativePath
            ? file.webkitRelativePath
            : file.name,
        content: await file.text()
      }))
    );

    setUploadFiles(nextFiles);
    setImportMode("upload");
    setSuccess(`已准备 ${nextFiles.length} 个文件，点击开始后会抽取源码里的静态文案候选。`);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    await handleFileSelection(event.dataTransfer.files);
  }

  async function handleTranslateCurrent() {
    if (!selectedPage || !selectedLanguage) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsTranslating(true);

    try {
      const response = (await translatePage({
        pageId: selectedPage.id,
        targetLanguage: selectedLanguage
      })) as { page: PageRecord };
      const nextTranslation = response.page.translations[selectedLanguage];
      if (nextTranslation) {
        setDraft(clonePageSchema(nextTranslation));
      }
      setLocallySavedContextKey(null);
      setCurrentStep("edit");
      setSuccess(
        isJsonDocumentPage
          ? `已生成 ${selectedLanguage.toUpperCase()} JSON 草稿。完整 JSON 已保留，可直接去回写代码。`
          : `已生成 ${selectedLanguage.toUpperCase()} 草稿。现在可以开始人工校对。`
      );
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "生成翻译失败。");
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleTranslateAllLanguages() {
    if (!selectedPage) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsTranslating(true);

    try {
      await translatePageAll(selectedPage.id);
      setLocallySavedContextKey(null);
      setCurrentStep("edit");
      setSuccess(
        isJsonDocumentPage
          ? "当前页面的所有目标语言 JSON 草稿都已生成。完整 JSON 已保留，可直接回写代码。"
          : "当前页面的所有目标语言草稿都已生成。你现在可以在同一页里逐个打开语言校对。"
      );
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "整页翻译失败。");
    } finally {
      setIsTranslating(false);
    }
  }

  function toggleBatchLanguage(language: string) {
    setBatchLanguages((current) =>
      current.includes(language) ? current.filter((item) => item !== language) : [...current, language]
    );
  }

  async function handleTranslateBatch() {
    if (!selectedProject?.id || !projectPages.length || !batchLanguages.length) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsTranslating(true);

    try {
      const response = (await runProject(selectedProject.id, batchLanguages)) as {
        pageCount: number;
        targetLanguages: string[];
        pages: PageRecord[];
      };

      if (response.targetLanguages[0]) {
        setSelectedLanguage(response.targetLanguages[0]);
      }

      const nextLanguage = response.targetLanguages[0];
      const nextPage = response.pages.find((page) => page.id === selectedPage?.id) ?? response.pages[0];
      if (nextPage?.id) {
        setSelectedPageId(nextPage.id);
      }
      if (nextPage && nextLanguage && nextPage.translations[nextLanguage]) {
        setDraft(clonePageSchema(nextPage.translations[nextLanguage]));
      }

      setLocallySavedContextKey(null);
      setCurrentStep("edit");
      setSuccess(
        `已批量生成 ${response.pageCount} 个页面的 ${response.targetLanguages.length} 种语言草稿。现在可以在同一页里逐个检查所有语言。`
      );
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "批量翻译失败。");
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedPage || !selectedLanguage || !draft) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSavingDraft(true);

    try {
      await saveTranslation({
        pageId: selectedPage.id,
        language: selectedLanguage,
        schema: draft
      });
      setLocallySavedContextKey(currentContextKey);
      setIsReviewModalOpen(false);
      setCurrentStep("edit");
      setSuccess("当前语言的校对结果已保存。你可以继续检查其他语言，或进入回写代码。");
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存翻译失败。");
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleSaveJsonDraft() {
    if (!selectedPage || !selectedLanguage) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSavingDraft(true);

    try {
      const document = JSON.parse(jsonDraftText) as unknown;
      await saveTranslation({
        pageId: selectedPage.id,
        language: selectedLanguage,
        document
      });
      setLocallySavedContextKey(currentContextKey);
      setIsReviewModalOpen(false);
      setCurrentStep("edit");
      setSuccess("当前语言的 JSON 修改已保存。你可以继续检查其他语言，或进入回写代码。");
      refreshData();
    } catch (requestError) {
      if (requestError instanceof SyntaxError) {
        setError("JSON 格式不合法，请先修正后再保存。");
      } else {
        setError(requestError instanceof Error ? requestError.message : "保存 JSON 翻译失败。");
      }
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleWriteBack() {
    if (!selectedProject?.id) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsWriting(true);
    setWrittenRoots([]);

    try {
      const response = (await saveProjectExports({
        projectId: selectedProject.id,
        targetPath: targetPath.trim() || undefined
      })) as { targetPath: string; bundleCount: number; writtenRoots: string[] };
      setWrittenRoots(response.writtenRoots);
      setSuccess(`已把 ${response.bundleCount} 个页面包写回 ${response.targetPath}。`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "回写失败。");
    } finally {
      setIsWriting(false);
    }
  }

  async function handleDeletePage(pageId: string) {
    setError(null);
    setMessage(null);

    try {
      await deletePage(pageId);
      if (selectedPageId === pageId) {
        const nextPage = projectPages.find((page) => page.id !== pageId);
        setSelectedPageId(nextPage?.id ?? "");
      }
      setSuccess("页面已删除。你可以继续新增页面，或直接翻译剩余页面。");
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "删除页面失败。");
    }
  }

  async function handleClearPages(input?: {
    confirmMessage?: string;
    successMessage?: string;
  }) {
    if (!selectedProject?.id) {
      return;
    }

    if (projectPages.length) {
      const confirmed = window.confirm(
        input?.confirmMessage ??
          `当前工作区还有 ${projectPages.length} 个页面。清空后这些页面和导出记录会从当前批次移除，继续吗？`
      );
      if (!confirmed) {
        return;
      }
    }

    setError(null);
    setMessage(null);
    setIsClearingPages(true);

    try {
      const response = (await clearProjectPages(selectedProject.id)) as { deletedCount: number };
      setSelectedPageId("");
      setLocallySavedContextKey(null);
      setLastImport(null);
      setDraft(null);
      setWrittenRoots([]);
      setTargetPath("");
      setCurrentStep("import");
      setSuccess(input?.successMessage ?? `已清空当前工作区的 ${response.deletedCount} 个页面。`);
      refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "清空页面失败。");
    } finally {
      setIsClearingPages(false);
    }
  }

  async function handleStartNextBatch() {
    await handleClearPages({
      confirmMessage: `当前工作区还有 ${projectPages.length} 个页面。开始下一批会清空这些旧页面和导出记录，继续吗？`,
      successMessage: "上一批页面已清空。现在可以直接接入下一批代码。"
    });
  }

  function handleOpenLanguageReview(language: string) {
    const translation = selectedPage?.translations[language];
    if (!translation) {
      return;
    }

    setSelectedLanguage(language);
    setDraft(clonePageSchema(translation));
    setJsonDraftText(
      selectedPage?.documentTranslations?.[language]
        ? JSON.stringify(selectedPage.documentTranslations[language].value, null, 2)
        : ""
    );
    setIsReviewModalOpen(true);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 space-y-8">
        <div className="ui-panel-muted py-4 px-4 sm:px-5">
          <div className="grid gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-5">
            {steps.map((step, index) => {
              const enabled = enabledSteps[step.id];
              const active = step.id === currentStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => enabled && setCurrentStep(step.id)}
                  className={`min-w-0 rounded-[1rem] border px-3 py-3 text-left transition ${
                    active
                      ? "border-ink/16 bg-white/92 text-ink shadow-[0_14px_30px_rgba(15,23,36,0.08)]"
                      : enabled
                        ? "border-ink/10 bg-white/48 text-ink/58 hover:border-ink/18 hover:bg-white/82 hover:text-ink"
                        : "border-ink/8 bg-transparent text-ink/28"
                  }`}
                >
                  <p className="ui-kicker">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 text-base text-ink">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-ink/52">{step.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ui-panel px-5 py-6 sm:px-6">
          {currentStep === "import" ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl">接入代码</h3>
                <p className="mt-3 text-sm leading-7 text-ink/70">
                  先把 KusaPics 的源码接进来。日常主入口应该是 Git 仓库或本地目录，手动粘贴只作为兜底。
                </p>
              </div>

              {projectPages.length ? (
                <div className="rounded-[1.25rem] border border-amber-300/70 bg-amber-50/90 p-5">
                  <p className="ui-kicker text-amber-800">当前工作区里还是上一批页面</p>
                  <p className="mt-2 text-lg text-ink">如果你现在要处理新一批页面，先清空旧批次再继续导入。</p>
                  <p className="mt-2 text-sm leading-7 text-ink/60">
                    如果只是给同一批补充页面，直接继续用下面的 Git、本地目录或上传入口接入即可。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <PrimaryButton onClick={() => void handleStartNextBatch()} disabled={isClearingPages}>
                      {isClearingPages ? "清空中..." : "开始下一批"}
                    </PrimaryButton>
                    <SecondaryButton onClick={() => setCurrentStep("translate")}>继续当前批次</SecondaryButton>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {importModes.map((mode) => {
                  const active = mode.id === importMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setImportMode(mode.id)}
                      className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                        active
                          ? "border-ink/18 bg-white/92 shadow-[0_16px_36px_rgba(15,23,36,0.08)]"
                          : "border-ink/10 bg-[rgba(240,245,250,0.72)] hover:border-ink/18 hover:bg-white/84"
                      }`}
                    >
                      <p className="text-base text-ink">{mode.label}</p>
                      <p className="mt-2 text-sm leading-6 text-ink/58">{mode.hint}</p>
                    </button>
                  );
                })}
              </div>

              {importMode === "git" ? (
                <form className="space-y-4" onSubmit={handleImportGit}>
                  <Field label="Git 仓库地址" value={gitUrl} onChange={setGitUrl} placeholder="https://github.com/your-org/KusaPics.git" />
                  <Field label="分支" value={gitBranch} onChange={setGitBranch} placeholder="main" />
                  <PrimaryButton disabled={!selectedProject?.id || !gitUrl.trim() || isImporting}>
                    {isImporting ? "接入中..." : "开始接入仓库"}
                  </PrimaryButton>
                </form>
              ) : null}

              {importMode === "folder" ? (
                <form className="space-y-4" onSubmit={handleImportFolder}>
                  <Field
                    label="本地目录路径"
                    value={folderPath}
                    onChange={setFolderPath}
                    placeholder="/Users/you/project/KusaPics"
                  />
                  <PrimaryButton disabled={!selectedProject?.id || !folderPath.trim() || isImporting}>
                    {isImporting ? "接入中..." : "读取本地目录"}
                  </PrimaryButton>
                </form>
              ) : null}

              {importMode === "upload" ? (
                <form className="space-y-4" onSubmit={handleImportUpload}>
                  <div
                    className="rounded-[1.25rem] border border-dashed border-ink/18 bg-[rgba(240,245,250,0.72)] p-6"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <p className="text-lg text-ink">拖拽代码文件到这里，或直接选择文件</p>
                    <p className="mt-2 text-sm leading-7 text-ink/58">
                      支持 md / html / tsx / jsx / ts / js / json。浏览器会先读取文件内容，再由后端抽取可见文案。
                    </p>
                    <label className="ui-button mt-4 cursor-pointer">
                      选择文件
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => void handleFileSelection(event.target.files)}
                      />
                    </label>
                  </div>

                  {uploadFiles.length ? (
                    <div className="ui-panel-muted p-4">
                      <p className="text-sm text-ink/52">待接入文件</p>
                      <div className="mt-3 max-h-40 space-y-2 overflow-auto text-sm text-ink/70">
                        {uploadFiles.map((file) => (
                          <p key={file.relativePath ?? file.name}>{file.relativePath ?? file.name}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <PrimaryButton disabled={!selectedProject?.id || !uploadFiles.length || isImporting}>
                    {isImporting ? "接入中..." : "开始接入文件"}
                  </PrimaryButton>
                </form>
              ) : null}

              {importMode === "manual" ? (
                <form className="space-y-4" onSubmit={handleManualCreatePage}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink/65">英文页面内容</span>
                    <button
                      type="button"
                      className="text-sm text-ink/60 underline underline-offset-4"
                      onClick={() => setContent(sampleTemplate)}
                    >
                      插入示例模板
                    </button>
                  </div>
                  <textarea
                    className="ui-textarea ui-mono min-h-[360px] bg-[rgba(240,245,250,0.72)]"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                  <PrimaryButton disabled={!selectedProject?.id || !content.trim() || isImporting}>
                    {isImporting ? "导入中..." : "导入当前内容"}
                  </PrimaryButton>
                </form>
              ) : null}

              {lastImport ? (
                <div className="ui-panel-muted p-4 text-sm leading-7 text-ink/64">
                  本次识别到 {lastImport.importedCount} 个文案单元
                  {lastImport.skippedCount ? `，跳过 ${lastImport.skippedCount} 个文件。` : "。"}
                </div>
              ) : null}

              <div className="ui-panel-muted p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="ui-kicker">当前批次页面</p>
                    <p className="mt-2 text-lg text-ink">{projectPages.length} 个页面</p>
                    <p className="mt-2 text-sm leading-7 text-ink/58">
                      这里管理当前批次里已经导入的页面。处理下一批前，建议先清空这里，避免旧页面继续参与后面的翻译和回写。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <SecondaryButton onClick={() => void handleStartNextBatch()} disabled={!projectPages.length || isClearingPages}>
                      {isClearingPages ? "清空中..." : "开始下一批"}
                    </SecondaryButton>
                    <PrimaryButton onClick={() => setCurrentStep("translate")} disabled={!projectPages.length}>
                      去生成翻译
                    </PrimaryButton>
                  </div>
                </div>

                {projectPages.length ? (
                  <div className="mt-5 grid gap-3">
                    {projectPages.map((page) => (
                      <div key={page.id} className="ui-panel-subtle flex flex-wrap items-start justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="text-base text-ink">{page.schema.title}</p>
                          <p className="ui-mono mt-1 break-all text-sm text-ink/55">
                            {page.sourceReference?.relativePath ?? page.sourceReference?.absolutePath ?? "手动导入"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedPageId(page.id)}
                            className="ui-button-secondary px-3 py-2 text-sm normal-case tracking-normal"
                          >
                            设为当前页面
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeletePage(page.id)}
                            className="rounded-[0.9rem] border border-red-200 bg-white/72 px-3 py-2 text-sm text-red-700 transition hover:border-red-300 hover:bg-white"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ui-panel-subtle mt-5 p-4 text-sm leading-7 text-ink/58">
                    当前还没有已导入页面。先从 Git、本地目录、上传文件或手动内容里导入一个页面。
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {currentStep === "translate" ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl">生成翻译草稿</h3>
                <p className="mt-3 text-sm leading-7 text-ink/70">
                  这里优先做整批翻译。你可以把当前已导入的多个页面，按选中的多种语言一次性全部翻出来，再进入校对。
                </p>
              </div>

              {selectedPage ? (
                <div className="space-y-4">
                  <div className="ui-panel-muted p-5">
                    <p className="ui-kicker">批量模式</p>
                    <p className="mt-2 text-lg text-ink">
                      {projectPages.length} 个页面 x {batchLanguages.length} 种语言
                    </p>
                    <p className="mt-2 text-sm leading-7 text-ink/58">
                      当前会对所有已导入页面一起生成草稿。适合你一次提交多个页面代码后，直接整批翻译。
                    </p>

                    <div className="mt-5">
                      <p className="ui-label">选择要一起生成的语言</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(selectedProject?.targetLanguages ?? []).map((language) => {
                          const selected = batchLanguages.includes(language);
                          return (
                            <button
                              key={language}
                              type="button"
                              onClick={() => toggleBatchLanguage(language)}
                              className={`ui-mono rounded-full border px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] transition ${
                                selected
                                  ? "border-ink bg-ink text-paper shadow-[0_12px_24px_rgba(15,23,36,0.16)]"
                                  : "border-ink/12 bg-white/72 text-ink"
                              }`}
                            >
                              {language}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <PrimaryButton
                        onClick={handleTranslateBatch}
                        disabled={!systemStatus.canTranslate || !projectPages.length || !batchLanguages.length || isTranslating}
                      >
                        {!systemStatus.canTranslate ? "请先配置模型" : isTranslating ? "批量生成中..." : `一键翻译全部页面 (${batchTaskCount})`}
                      </PrimaryButton>
                    </div>
                  </div>

                  <div className="border-t border-ink/10 pt-4">
                    <p className="ui-label">单页试跑</p>
                    <p className="mt-2 text-sm leading-7 text-ink/58">
                      如果你只想先抽查某个页面或某个语言，可以在下面单独生成，不影响整批入口。
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="min-w-0">
                      <SelectField
                        label="当前页面"
                        value={selectedPage.id}
                        onChange={setSelectedPageId}
                        options={projectPages.map((page) => ({ value: page.id, label: page.schema.title }))}
                      />
                    </div>
                    <SelectField
                      label="目标语言"
                      value={selectedLanguage}
                      onChange={setSelectedLanguage}
                      options={(selectedProject?.targetLanguages ?? []).map((language) => ({
                        value: language,
                        label: language.toUpperCase()
                      }))}
                    />
                  </div>

                  <div className="ui-panel-muted p-5">
                    <p className="ui-kicker">当前将翻译</p>
                    <p className="mt-2 text-lg text-ink">{selectedPage.schema.title}</p>
                    <p className="mt-2 text-sm leading-7 text-ink/58">{selectedPage.schema.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <PrimaryButton
                      onClick={handleTranslateCurrent}
                      disabled={!systemStatus.canTranslate || !selectedLanguage || isTranslating}
                    >
                      {!systemStatus.canTranslate ? "请先配置模型" : isTranslating ? "生成中..." : "只翻当前页面当前语言"}
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={handleTranslateAllLanguages}
                      disabled={!systemStatus.canTranslate || isTranslating}
                    >
                      只翻当前页面全部语言
                    </SecondaryButton>
                  </div>

                  {draft ? (
                    <div className="ui-panel-muted p-4 text-sm leading-7 text-ink/64">
                      当前语言已经有翻译结果了。你可以直接进入下一步继续校对。
                      <div className="mt-3">
                        <PrimaryButton onClick={() => setCurrentStep("edit")}>去人工校对</PrimaryButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="还没有可翻译页面"
                  description="先完成代码接入，系统识别到页面后，这里就会出现可翻译列表。"
                  action={{ href: "#", label: "回到接入代码", onClick: () => setCurrentStep("import") }}
                />
              )}
            </div>
          ) : null}

          {currentStep === "edit" ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl">人工校对</h3>
                <p className="mt-3 text-sm leading-7 text-ink/70">
                  {isJsonDocumentPage
                    ? "当前页面的目标语言会在下面一字排开。点击任一语言，会弹窗展示该语言的完整 JSON 翻译内容。"
                    : "当前页面的目标语言会在下面一字排开。点击任一语言，会弹窗展示该语言的完整翻译内容并允许你保存修改。"}
                </p>
              </div>

              {selectedPage && selectedPageHasTranslations ? (
                <div className="space-y-6">
                  <div className="ui-panel-muted p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="ui-kicker">当前页面</p>
                        <p className="mt-2 text-lg text-ink">{selectedPage.schema.title}</p>
                        <p className="mt-2 text-sm leading-7 text-ink/58">{selectedPage.schema.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <SecondaryButton onClick={() => setCurrentStep("translate")}>返回生成翻译</SecondaryButton>
                        <PrimaryButton onClick={() => setCurrentStep("export")} disabled={!hasWritableTranslations}>
                          去回写代码
                        </PrimaryButton>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {languageReviewItems.map((item) => (
                        <LanguageReviewCard
                          key={item.language}
                          language={item.language}
                          translation={item.translation}
                          isActive={item.language === selectedLanguage}
                          onOpen={() => handleOpenLanguageReview(item.language)}
                        />
                      ))}
                    </div>

                    <p className="mt-4 text-sm leading-7 text-ink/58">
                      当前页面已生成 {languageReviewItems.filter((item) => item.hasTranslation).length} / {languageReviewItems.length} 种语言。
                      点击任一已生成语言，会在弹窗里展开完整内容，保存后会回到这里继续检查其他语言。
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <SchemaPreviewCard title="英文源文案" markdown={renderPageMarkdown(selectedPage.schema)} />
                    <div className="ui-panel-subtle p-5">
                      <p className="ui-kicker">校对方式</p>
                      <p className="mt-3 text-sm leading-7 text-ink/58">
                        1. 在上面点一个语言。
                      </p>
                      <p className="text-sm leading-7 text-ink/58">
                        2. 弹窗里看该语言的完整内容并修改。
                      </p>
                      <p className="text-sm leading-7 text-ink/58">
                        3. 保存后回到这里，再继续检查其他语言。
                      </p>
                      {isJsonDocumentPage ? (
                        <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-7 text-amber-800">
                          JSON 页会展示完整 JSON 结果，并支持直接修改目标语言 JSON；保存时会自动同步更新导出用的 schema。
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {isReviewModalOpen ? (
                    <ReviewLanguageModal
                      page={selectedPage}
                      language={selectedLanguage}
                      draft={draft}
                      setDraft={setDraft}
                      jsonDraftText={jsonDraftText}
                      setJsonDraftText={setJsonDraftText}
                      isJsonDocumentPage={isJsonDocumentPage}
                      isSavingDraft={isSavingDraft}
                      onClose={() => setIsReviewModalOpen(false)}
                      onSave={isJsonDocumentPage ? handleSaveJsonDraft : handleSaveDraft}
                    />
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="当前页面还没有可校对语言"
                  description="先回到上一步生成至少一个目标语言草稿。草稿出来以后，这里会把五种语言一起列出来。"
                  action={{ href: "#", label: "返回生成翻译", onClick: () => setCurrentStep("translate") }}
                />
              )}
            </div>
          ) : null}

          {currentStep === "export" ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl">回写代码</h3>
                <p className="mt-3 text-sm leading-7 text-ink/70">
                  最后一步是把当前工作区已有的翻译结果写回本地目录或仓库工作树。留空时会优先使用导入根目录。
                </p>
              </div>

              {hasWritableTranslations ? (
                <div className="space-y-4">
                  <Field
                    label="目标目录"
                    value={targetPath}
                    onChange={setTargetPath}
                    placeholder={suggestedWritePath || "/path/to/your/repo"}
                  />

                  <div className="ui-panel-muted p-5">
                    <p className="ui-kicker">本次将写回</p>
                    <p className="mt-2 text-lg text-ink">{projectPages.length} 个页面单元</p>
                    <p className="mt-2 text-sm leading-7 text-ink/58">
                      当前已有 {projectPages.filter((page) => Object.keys(page.translations).length > 0).length} 个页面带翻译结果。
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <SecondaryButton onClick={() => setCurrentStep("edit")}>返回人工校对</SecondaryButton>
                    <PrimaryButton onClick={handleWriteBack} disabled={isWriting}>
                      {isWriting ? "回写中..." : "写回到代码目录"}
                    </PrimaryButton>
                  </div>

                  {writtenRoots.length ? (
                    <div className="border border-leaf/20 bg-leaf/5 p-5">
                      <p className="text-sm uppercase tracking-[0.16em] text-leaf">这一批已经写回完成</p>
                      <p className="mt-2 text-lg text-ink">如果接下来要处理新页面，建议直接开始下一批。</p>
                      <p className="mt-2 text-sm leading-7 text-ink/60">
                        这样会先清空旧页面，避免它们再次出现在“接入代码”和批量翻译列表里，影响下一轮操作。
                      </p>
                      <div className="mt-4">
                        <PrimaryButton onClick={() => void handleStartNextBatch()} disabled={!projectPages.length || isClearingPages}>
                          {isClearingPages ? "清空中..." : "开始下一批"}
                        </PrimaryButton>
                      </div>
                    </div>
                  ) : null}

                  {writtenRoots.length ? (
                    <div className="ui-panel-muted p-4">
                      <p className="text-lg text-ink">已写入位置</p>
                      <div className="ui-mono mt-3 space-y-2 text-sm leading-7 text-ink/58">
                        {writtenRoots.map((root) => (
                          <p key={root}>{root}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="当前还没有可回写结果"
                  description="先完成至少一个目标语言的翻译和保存，再回到这里写回代码。"
                  action={{ href: "#", label: "返回生成翻译", onClick: () => setCurrentStep("translate") }}
                />
              )}
            </div>
          ) : null}

          {message ? <p className="text-sm text-leaf">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </section>

      <aside className="space-y-4 2xl:sticky 2xl:top-8 2xl:self-start">
        <section className="ui-panel p-5">
          <p className="ui-kicker">Runtime Context</p>
          <h3 className="mt-3 text-2xl">当前上下文</h3>
          <div className="mt-5 space-y-4 text-sm leading-7 text-ink/64">
            <div>
              <p className="ui-kicker text-ink/40">工作区</p>
              <p className="text-ink">{selectedProject?.name ?? "KusaPics"}</p>
            </div>
            <div>
              <p className="ui-kicker text-ink/40">目标语言</p>
              <p className="ui-mono text-ink">{selectedLanguage ? selectedLanguage.toUpperCase() : "未选择"}</p>
            </div>
            <div>
              <p className="ui-kicker text-ink/40">当前页面</p>
              <p className="text-ink">{selectedPage?.schema.title ?? "还没有页面"}</p>
            </div>
            <div>
              <p className="ui-kicker text-ink/40">来源文件</p>
              <p className="ui-mono break-all text-ink">
                {selectedPage?.sourceReference?.relativePath ?? selectedPage?.sourceReference?.absolutePath ?? "未接入"}
              </p>
            </div>
            <div>
              <p className="ui-kicker text-ink/40">抽取条数</p>
              <p className="ui-mono text-ink">{extractedCount}</p>
            </div>
            <div>
              <p className="ui-kicker text-ink/40">锁词规则</p>
              <p className="ui-mono text-ink">{locks.length} 条</p>
            </div>
          </div>
        </section>

        <section className="ui-panel p-5">
          <p className="ui-kicker">Secondary Routes</p>
          <h3 className="mt-3 text-2xl">辅助入口</h3>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/keywords" className="ui-link-button">
              去规则页
            </Link>
            <Link href="/settings" className="ui-link-button">
              去设置页
            </Link>
          </div>

          {!systemStatus.canTranslate ? (
            <p className="mt-5 border-t border-ink/10 pt-4 text-sm leading-7 text-ink/58">
              还没有配置可用模型。先去设置页把 provider、model 和 API Key 配好，工作台里的翻译步骤才会真正可用。
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
