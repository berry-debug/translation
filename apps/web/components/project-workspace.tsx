"use client";

import type { Project } from "@seo-localization/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { createProject } from "../lib/api-actions";
import { languageOptions } from "../lib/language-options";

interface ProjectWorkspaceProps {
  projects: Project[];
}

const selectableLanguages = languageOptions.filter((item) => item.selectable);

export function ProjectWorkspace({ projects }: ProjectWorkspaceProps) {
  const router = useRouter();
  const existingProject = projects[0];
  const [name, setName] = useState(existingProject?.name ?? "KusaPics");
  const [baseUrl, setBaseUrl] = useState(existingProject?.baseUrl ?? "https://kusa.pics");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    selectableLanguages.map((item) => item.code.toLowerCase())
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();

  const canSubmit = Boolean(name.trim() && baseUrl.trim() && selectedLanguages.length > 0);

  const selectedSummary = useMemo(
    () => selectableLanguages.filter((item) => selectedLanguages.includes(item.code.toLowerCase())),
    [selectedLanguages]
  );

  useEffect(() => {
    if (!existingProject) {
      return;
    }

    setName(existingProject.name);
    setBaseUrl(existingProject.baseUrl);
    setSelectedLanguages(existingProject.targetLanguages);
  }, [existingProject]);

  function toggleLanguage(languageCode: string) {
    const code = languageCode.toLowerCase();
    setSelectedLanguages((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSaving) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      await createProject({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        targetLanguages: selectedLanguages
      });
      setMessage("站点配置已保存，可以继续去“接入代码”导入 KusaPics 源码。");
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存工作区配置失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="ui-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="ui-kicker">Workspace Config</p>
            <h3 className="mt-3 text-2xl">配置 KusaPics 站点信息</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/62">
              系统现在固定只服务 `kusa.pics`。这里不再创建多个项目，而是维护唯一站点的域名和目标语言配置。
            </p>
          </div>
        </div>

        <form className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="block">
              <span className="ui-label">工作区名称</span>
              <input
                className="ui-input"
                placeholder="例如：KusaPics Internal Localization"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="ui-label">站点基础域名</span>
              <input
                className="ui-input"
                placeholder="https://site.com"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </label>

            <div className="ui-panel-muted p-4 text-sm text-ink/72">
              <p className="ui-kicker">当前规则</p>
              <p className="mt-2">源语言固定为 `en`。目标语言只包含需要新增生成的多语言版本。</p>
              <p className="mt-2">这页不属于日常主流程。通常只在首次接入或改语言范围时才需要调整。</p>
              <p className="mt-2">已选择：{selectedSummary.map((item) => item.code).join(", ") || "未选择目标语言"}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canSubmit || isSaving}
                className="ui-button"
              >
                {isSaving ? "保存中..." : existingProject ? "保存工作区配置" : "初始化工作区"}
              </button>
              <Link href="/" className="ui-link-button">
                回到工作台
              </Link>
            </div>

            {message ? <p className="text-sm text-leaf">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div>
            <p className="ui-label">目标语言选择</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {languageOptions.map((language) => {
                const selected = language.selectable
                  ? selectedLanguages.includes(language.code.toLowerCase())
                  : true;

                return (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => language.selectable && toggleLanguage(language.code)}
                    className={`rounded-[1.25rem] border p-5 text-left transition ${
                      selected
                        ? "border-ink/18 bg-white/90 shadow-[0_14px_32px_rgba(15,23,36,0.08)]"
                        : "border-ink/10 bg-[rgba(240,245,250,0.72)] hover:border-ink/18 hover:bg-white/72"
                    } ${language.selectable ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="ui-mono inline-flex rounded-full border border-ink/12 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-ink">
                        {language.code}
                      </span>
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${
                          selected ? "border-ink bg-ink text-white" : "border-ink/16 bg-transparent text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </div>
                    <h4 className="mt-6 text-2xl">{language.zhName}</h4>
                    <p className="mt-2 text-sm text-ink/72">{language.enName}</p>
                    <p className="mt-5 text-sm leading-6 text-ink/56">
                      {language.selectable ? "勾选后将参与翻译与导出" : "默认源语言，不进入目标翻译列表"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </section>

      <section className="ui-panel p-6">
        <div>
          <p className="ui-kicker">Current Site</p>
          <h3 className="mt-3 text-2xl">KusaPics 单项目配置</h3>
        </div>

        <article className="ui-panel-muted mt-6 p-5">
          <div>
            <h4 className="text-xl">{existingProject?.name ?? "KusaPics"}</h4>
            <p className="ui-mono mt-2 text-sm text-ink/62">{existingProject?.baseUrl ?? "https://kusa.pics"}</p>
          </div>
          <p className="mt-4 text-sm text-ink/72">
            目标语言：{(existingProject?.targetLanguages ?? selectedLanguages).length ? (existingProject?.targetLanguages ?? selectedLanguages).join(", ") : "未配置"}
          </p>
        </article>
      </section>
    </div>
  );
}
