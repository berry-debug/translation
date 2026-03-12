"use client";

import { renderPageMarkdown, type PageRecord, type PageSchema } from "@seo-localization/shared";
import { createPortal } from "react-dom";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { TranslationDraftEditor } from "./translation-draft-editor";
import {
  JsonEditorCard,
  JsonPreviewCard,
  PrimaryButton,
  SchemaPreviewCard,
  SecondaryButton
} from "./workflow-primitives";

interface ReviewLanguageModalProps {
  page: PageRecord;
  language: string;
  draft: PageSchema | null;
  setDraft: Dispatch<SetStateAction<PageSchema | null>>;
  jsonDraftText: string;
  setJsonDraftText: Dispatch<SetStateAction<string>>;
  isJsonDocumentPage: boolean;
  isSavingDraft: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export function ReviewLanguageModal(input: ReviewLanguageModalProps) {
  const sourceScrollRef = useRef<HTMLPreElement | null>(null);
  const targetPreviewScrollRef = useRef<HTMLPreElement | null>(null);
  const targetEditorScrollRef = useRef<HTMLTextAreaElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        input.onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [input.onClose]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  function syncScrollPosition(source: HTMLElement, target?: HTMLElement | null) {
    if (!target || isSyncingScrollRef.current) {
      return;
    }

    isSyncingScrollRef.current = true;

    const sourceMaxTop = Math.max(source.scrollHeight - source.clientHeight, 1);
    const sourceMaxLeft = Math.max(source.scrollWidth - source.clientWidth, 1);
    const targetMaxTop = Math.max(target.scrollHeight - target.clientHeight, 0);
    const targetMaxLeft = Math.max(target.scrollWidth - target.clientWidth, 0);

    target.scrollTop = (source.scrollTop / sourceMaxTop) * targetMaxTop;
    target.scrollLeft = (source.scrollLeft / sourceMaxLeft) * targetMaxLeft;

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }

  useEffect(() => {
    const sourceNode = sourceScrollRef.current;
    const previewNode = targetPreviewScrollRef.current;
    const editorNode = targetEditorScrollRef.current;
    const targetNode = input.isJsonDocumentPage ? editorNode : previewNode;

    if (!sourceNode || !targetNode) {
      return;
    }

    const handleSourceScroll = () => syncScrollPosition(sourceNode, targetNode);
    const handleTargetScroll = () => syncScrollPosition(targetNode, sourceNode);

    sourceNode.addEventListener("scroll", handleSourceScroll, { passive: true });
    targetNode.addEventListener("scroll", handleTargetScroll, { passive: true });

    return () => {
      sourceNode.removeEventListener("scroll", handleSourceScroll);
      targetNode.removeEventListener("scroll", handleTargetScroll);
    };
  }, [input.isJsonDocumentPage, input.jsonDraftText, input.draft]);

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink/45" onClick={input.onClose}>
      <div
        className="ui-panel flex h-[100dvh] w-[100vw] flex-col overflow-hidden rounded-none border-0 shadow-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="ui-kicker">语言校对</p>
            <p className="mt-2 text-xl text-ink">
              {input.page.schema.title} · {input.language.toUpperCase()}
            </p>
          </div>
          <SecondaryButton onClick={input.onClose}>关闭弹窗</SecondaryButton>
        </div>

        <div className="flex-1 overflow-auto px-5 py-6 sm:px-6">
          {input.isJsonDocumentPage ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <JsonPreviewCard
                  title="英文源 JSON"
                  value={input.page.sourceDocument?.value}
                  scrollRef={sourceScrollRef}
                />
                <JsonEditorCard
                  title={`${input.language.toUpperCase()} 翻译 JSON`}
                  value={input.jsonDraftText}
                  onChange={input.setJsonDraftText}
                  scrollRef={targetEditorScrollRef}
                />
              </div>

              <p className="text-sm leading-7 text-ink/58">
                这里可以直接修改目标语言 JSON。点击保存后，系统会基于你当前的 JSON 内容重新生成 schema，保证导出结果和人工校对一致。
              </p>

              <div className="flex flex-wrap justify-end gap-3">
                <SecondaryButton onClick={input.onClose}>关闭弹窗</SecondaryButton>
                <PrimaryButton onClick={input.onSave} disabled={input.isSavingDraft}>
                  {input.isSavingDraft ? "保存中..." : `保存 ${input.language.toUpperCase()} JSON`}
                </PrimaryButton>
              </div>
            </div>
          ) : input.draft ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <SchemaPreviewCard
                  title="英文源文案"
                  markdown={renderPageMarkdown(input.page.schema)}
                  scrollRef={sourceScrollRef}
                />
                <SchemaPreviewCard
                  title={`${input.language.toUpperCase()} 翻译预览`}
                  markdown={renderPageMarkdown(input.draft)}
                  scrollRef={targetPreviewScrollRef}
                />
              </div>

              <TranslationDraftEditor draft={input.draft} setDraft={input.setDraft} />

              <div className="flex flex-wrap justify-end gap-3">
                <SecondaryButton onClick={input.onClose}>关闭弹窗</SecondaryButton>
                <PrimaryButton onClick={input.onSave} disabled={input.isSavingDraft}>
                  {input.isSavingDraft ? "保存中..." : `保存 ${input.language.toUpperCase()} 修改`}
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <div className="ui-panel-muted p-5 text-sm leading-7 text-ink/58">
              当前语言还没有可展示的翻译内容。请先回到“生成翻译”补齐该语言草稿。
            </div>
          )}
        </div>
      </div>
    </div>,
    portalRoot
  );
}
