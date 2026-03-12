import { type PageSchema } from "@seo-localization/shared";
import { type Dispatch, type SetStateAction } from "react";

type DraftSetter = Dispatch<SetStateAction<PageSchema | null>>;

export function clonePageSchema(page: PageSchema): PageSchema {
  return {
    ...page,
    sections: page.sections.map((section) => ({ ...section })),
    faq: page.faq.map((item) => ({ ...item }))
  };
}

export function updateSection(
  setDraft: DraftSetter,
  index: number,
  field: "heading" | "content",
  value: string
) {
  setDraft((current) =>
    current
      ? {
          ...current,
          sections: current.sections.map((section, sectionIndex) =>
            sectionIndex === index ? { ...section, [field]: value } : section
          )
        }
      : current
  );
}

export function updateFaq(
  setDraft: DraftSetter,
  index: number,
  field: "question" | "answer",
  value: string
) {
  setDraft((current) =>
    current
      ? {
          ...current,
          faq: current.faq.map((item, itemIndex) =>
            itemIndex === index ? { ...item, [field]: value } : item
          )
        }
      : current
  );
}
