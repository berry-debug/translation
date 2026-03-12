"use client";

import type { KeywordLock, Project } from "@seo-localization/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { createKeywordLock } from "../lib/api-actions";

interface KeywordWorkspaceProps {
  projects: Project[];
  locks: KeywordLock[];
}

export function KeywordWorkspace({ projects, locks }: KeywordWorkspaceProps) {
  const router = useRouter();
  const selectedProject = projects[0];
  const [sourceKeyword, setSourceKeyword] = useState("AI Interior Design");
  const [targetLanguage, setTargetLanguage] = useState(projects[0]?.targetLanguages[0] ?? "");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();

  const filteredLocks = useMemo(
    () => locks.filter((lock) => !selectedProject || lock.projectId === selectedProject.id),
    [locks, selectedProject]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject?.id || !sourceKeyword.trim() || !targetLanguage || !targetKeyword.trim()) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      await createKeywordLock({
        projectId: selectedProject.id,
        sourceKeyword: sourceKeyword.trim(),
        targetLanguage,
        targetKeyword: targetKeyword.trim()
      });
      setTargetKeyword("");
      setMessage("关键词锁定已保存。新的翻译任务会自动使用该映射。");
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存关键词锁定失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (!projects.length) {
    return (
      <section className="ui-panel p-8">
        <p className="ui-kicker">Setup Required</p>
        <h3 className="mt-3 text-2xl">请先初始化工作区</h3>
        <p className="mt-3 text-sm leading-7 text-ink/62">关键词锁定属于 KusaPics 工作区，必须先完成基础配置。</p>
        <Link href="/projects" className="ui-button mt-6">
          去配置工作区
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="ui-panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="ui-kicker">Keyword Locks</p>
            <h3 className="mt-3 text-2xl">配置 SEO 锁词规则</h3>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="ui-panel-muted p-4 text-sm text-ink/72">
            <p className="mt-2">{selectedProject?.name ?? "KusaPics"}</p>
          </div>

          <label className="block">
            <span className="ui-label">源关键词</span>
            <input
              className="ui-input"
              value={sourceKeyword}
              onChange={(event) => setSourceKeyword(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="ui-label">目标语言</span>
            <select
              className="ui-select"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
            >
              {(selectedProject?.targetLanguages ?? []).map((language) => (
                <option key={language} value={language}>
                  {language.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="ui-label">锁定后的关键词</span>
            <input
              className="ui-input"
              placeholder="例如：Conception intérieure IA"
              value={targetKeyword}
              onChange={(event) => setTargetKeyword(event.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={!selectedProject?.id || !targetLanguage || !sourceKeyword.trim() || !targetKeyword.trim() || isSaving}
            className="ui-button"
          >
            {isSaving ? "保存中..." : "保存关键词锁定"}
          </button>

          {message ? <p className="text-sm text-leaf">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </section>

      <section className="ui-panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="ui-kicker">Current Rules</p>
            <h3 className="mt-3 text-2xl">当前工作区关键词锁定</h3>
          </div>
        </div>

        <div className="ui-panel-subtle mt-6 overflow-hidden">
          <table className="min-w-full divide-y divide-ink/10 text-left text-sm">
            <thead className="bg-[rgba(233,239,246,0.82)] text-ink/55">
              <tr>
                <th className="px-4 py-3 font-medium">源关键词</th>
                <th className="px-4 py-3 font-medium">语言</th>
                <th className="px-4 py-3 font-medium">锁定词</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10 bg-white/72">
              {filteredLocks.map((lock) => (
                <tr key={lock.id}>
                  <td className="px-4 py-4 font-medium">{lock.sourceKeyword}</td>
                  <td className="ui-mono px-4 py-4 uppercase">{lock.targetLanguage}</td>
                  <td className="px-4 py-4">{lock.targetKeyword}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
