import { type PageSchema } from "@seo-localization/shared";
import { type Dispatch, type SetStateAction } from "react";
import { updateFaq, updateSection } from "./draft-utils";
import { Field, TextAreaField } from "./workflow-primitives";

interface TranslationDraftEditorProps {
  draft: PageSchema;
  setDraft: Dispatch<SetStateAction<PageSchema | null>>;
}

export function TranslationDraftEditor(input: TranslationDraftEditorProps) {
  return (
    <div className="ui-panel-muted space-y-4 p-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <Field
          label="Title"
          value={input.draft.title}
          onChange={(value) => input.setDraft((current) => (current ? { ...current, title: value } : current))}
        />
        <Field
          label="H1"
          value={input.draft.h1}
          onChange={(value) => input.setDraft((current) => (current ? { ...current, h1: value } : current))}
        />
      </div>

      <TextAreaField
        label="Description"
        value={input.draft.description}
        onChange={(value) =>
          input.setDraft((current) => (current ? { ...current, description: value } : current))
        }
      />

      <div className="ui-panel-subtle p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg text-ink">章节</p>
          <button
            type="button"
            onClick={() =>
              input.setDraft((current) =>
                current
                  ? {
                      ...current,
                      sections: [...current.sections, { heading: "新章节", content: "" }]
                    }
                  : current
              )
            }
            className="text-sm text-ink/60 underline underline-offset-4"
          >
            添加章节
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {input.draft.sections.map((section, index) => (
            <div key={`${index}-${section.heading}`} className="ui-panel-code p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink/65">章节 {index + 1}</p>
                <button
                  type="button"
                  onClick={() =>
                    input.setDraft((current) =>
                      current
                        ? {
                            ...current,
                            sections: current.sections.filter((_, currentIndex) => currentIndex !== index)
                          }
                        : current
                    )
                  }
                  className="text-sm text-red-600"
                >
                  删除
                </button>
              </div>
              <div className="mt-4">
                <Field
                  label="Heading"
                  value={section.heading}
                  onChange={(value) => updateSection(input.setDraft, index, "heading", value)}
                />
              </div>
              <div className="mt-4">
                <TextAreaField
                  label="Content"
                  value={section.content}
                  onChange={(value) => updateSection(input.setDraft, index, "content", value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-panel-subtle p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg text-ink">FAQ</p>
          <button
            type="button"
            onClick={() =>
              input.setDraft((current) =>
                current
                  ? {
                      ...current,
                      faq: [...current.faq, { question: "新问题", answer: "" }]
                    }
                  : current
              )
            }
            className="text-sm text-ink/60 underline underline-offset-4"
          >
            添加 FAQ
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {input.draft.faq.map((item, index) => (
            <div key={`${index}-${item.question}`} className="ui-panel-code p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink/65">FAQ {index + 1}</p>
                <button
                  type="button"
                  onClick={() =>
                    input.setDraft((current) =>
                      current
                        ? {
                            ...current,
                            faq: current.faq.filter((_, currentIndex) => currentIndex !== index)
                          }
                        : current
                    )
                  }
                  className="text-sm text-red-600"
                >
                  删除
                </button>
              </div>
              <div className="mt-4">
                <Field
                  label="Question"
                  value={item.question}
                  onChange={(value) => updateFaq(input.setDraft, index, "question", value)}
                />
              </div>
              <div className="mt-4">
                <TextAreaField
                  label="Answer"
                  value={item.answer}
                  onChange={(value) => updateFaq(input.setDraft, index, "answer", value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
