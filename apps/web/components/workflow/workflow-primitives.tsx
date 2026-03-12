import { type PageSchema } from "@seo-localization/shared";
import Link from "next/link";
import { type ReactNode, type RefObject } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action: { href: string; label: string; onClick?: () => void };
}

interface SchemaPreviewCardProps {
  title: string;
  markdown: string;
  scrollRef?: RefObject<HTMLPreElement | null>;
}

interface JsonPreviewCardProps {
  title: string;
  value: unknown;
  scrollRef?: RefObject<HTMLPreElement | null>;
}

interface JsonEditorCardProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  scrollRef?: RefObject<HTMLTextAreaElement | null>;
}

interface LanguageReviewCardProps {
  language: string;
  translation?: PageSchema;
  isActive: boolean;
  onOpen: () => void;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function EmptyState(input: EmptyStateProps) {
  return (
    <div className="ui-panel-muted p-8">
      <p className="ui-kicker">Empty State</p>
      <h4 className="text-2xl">{input.title}</h4>
      <p className="mt-3 text-sm leading-7 text-ink/58">{input.description}</p>
      {input.action.onClick ? (
        <button
          type="button"
          onClick={input.action.onClick}
          className="ui-button mt-5"
        >
          {input.action.label}
        </button>
      ) : (
        <Link href={input.action.href} className="ui-button mt-5">
          {input.action.label}
        </Link>
      )}
    </div>
  );
}

export function SchemaPreviewCard(input: SchemaPreviewCardProps) {
  return (
    <article className="ui-panel-subtle flex min-w-0 flex-col p-4">
      <p className="ui-kicker">Preview</p>
      <h4 className="mt-3 text-lg">{input.title}</h4>
      <pre
        ref={input.scrollRef}
        className="ui-panel-code ui-mono mt-3 min-h-[52vh] flex-1 overflow-auto whitespace-pre-wrap p-4 text-xs leading-6 text-ink/80"
      >
        {input.markdown}
      </pre>
    </article>
  );
}

export function JsonPreviewCard(input: JsonPreviewCardProps) {
  return (
    <article className="ui-panel-subtle flex min-w-0 flex-col p-4">
      <p className="ui-kicker">Source JSON</p>
      <h4 className="mt-3 text-lg">{input.title}</h4>
      <pre
        ref={input.scrollRef}
        className="ui-panel-code ui-mono mt-3 min-h-[52vh] flex-1 overflow-auto whitespace-pre-wrap p-4 text-xs leading-6 text-ink/80"
      >
        {JSON.stringify(input.value ?? {}, null, 2)}
      </pre>
    </article>
  );
}

export function JsonEditorCard(input: JsonEditorCardProps) {
  return (
    <article className="ui-panel-subtle flex min-w-0 flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="ui-kicker">Editable</p>
          <h4 className="mt-3 text-lg">{input.title}</h4>
        </div>
        <span className="ui-kicker">可编辑</span>
      </div>
      <textarea
        ref={input.scrollRef}
        className="ui-textarea ui-panel-code ui-mono mt-3 min-h-[52vh] flex-1 border-0 p-4 text-xs leading-6 text-ink/80"
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
        spellCheck={false}
      />
    </article>
  );
}

export function LanguageReviewCard(input: LanguageReviewCardProps) {
  const interactive = Boolean(input.translation);

  return (
    <button
      type="button"
      onClick={input.onOpen}
      disabled={!interactive}
      className={`rounded-[1.2rem] border p-4 text-left transition ${
        input.isActive
          ? "border-ink/18 bg-white/92 shadow-[0_16px_36px_rgba(15,23,36,0.08)]"
          : interactive
            ? "border-ink/10 bg-white/68 hover:border-ink/20 hover:bg-white/88"
            : "border-ink/8 bg-[rgba(240,245,250,0.72)] text-ink/38"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="ui-mono text-sm font-medium uppercase tracking-[0.16em]">{input.language}</p>
        <span
          className={`text-[11px] uppercase tracking-[0.16em] ${
            interactive ? "text-leaf" : "text-ink/35"
          }`}
        >
          {interactive ? "已生成" : "未生成"}
        </span>
      </div>

      <p className="mt-4 text-base text-ink">{input.translation?.title ?? "当前语言还没有翻译结果"}</p>
      <p className="mt-2 text-sm leading-6 text-ink/58">
        {input.translation
          ? `${input.translation.sections.length} 个章节，${input.translation.faq.length} 个 FAQ。点击查看完整内容。`
          : "先去上一阶段生成这个语言的草稿，再回来统一校对。"}
      </p>
    </button>
  );
}

export function Field(input: FieldProps) {
  return (
    <label className="block">
      <span className="ui-label">{input.label}</span>
      <input
        className="ui-input"
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
        placeholder={input.placeholder}
      />
    </label>
  );
}

export function TextAreaField(input: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className="ui-label">{input.label}</span>
      <textarea
        className="ui-textarea"
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
      />
    </label>
  );
}

export function SelectField(input: SelectFieldProps) {
  return (
    <label className="block">
      <span className="ui-label">{input.label}</span>
      <select
        className="ui-select"
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
      >
        {input.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PrimaryButton(input: ButtonProps) {
  return (
    <button
      type={input.onClick ? "button" : "submit"}
      onClick={input.onClick}
      disabled={input.disabled}
      className="ui-button"
    >
      {input.children}
    </button>
  );
}

export function SecondaryButton(input: ButtonProps) {
  return (
    <button
      type="button"
      onClick={input.onClick}
      disabled={input.disabled}
      className="ui-button-secondary"
    >
      {input.children}
    </button>
  );
}
