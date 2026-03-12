import type { FaqItem, PageSchema, PageSection } from "./types";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePageSchema(input: PageSchema): PageSchema {
  return {
    slug: slugify(input.slug || input.h1 || input.title),
    title: input.title.trim(),
    description: input.description.trim(),
    h1: input.h1.trim(),
    sections: input.sections.map((section) => normalizeSection(section)),
    faq: input.faq.map((item) => normalizeFaq(item))
  };
}

function normalizeSection(section: PageSection): PageSection {
  return {
    heading: section.heading.trim(),
    content: section.content.trim()
  };
}

function normalizeFaq(item: FaqItem): FaqItem {
  return {
    question: item.question.trim(),
    answer: item.answer.trim()
  };
}

export function transformPageSchema(
  page: PageSchema,
  mapper: (value: string, field: string) => string
): PageSchema {
  return {
    ...page,
    title: mapper(page.title, "title"),
    description: mapper(page.description, "description"),
    h1: mapper(page.h1, "h1"),
    sections: page.sections.map((section, index) => ({
      heading: mapper(section.heading, `sections.${index}.heading`),
      content: mapper(section.content, `sections.${index}.content`)
    })),
    faq: page.faq.map((item, index) => ({
      question: mapper(item.question, `faq.${index}.question`),
      answer: mapper(item.answer, `faq.${index}.answer`)
    }))
  };
}

export function renderPageMarkdown(page: PageSchema): string {
  const sectionBlocks = page.sections
    .map((section) => `## ${section.heading}\n\n${section.content}`)
    .join("\n\n");

  const faqBlock = page.faq.length
    ? `\n\n## FAQ\n\n${page.faq
        .map((item) => `### ${item.question}\n\n${item.answer}`)
        .join("\n\n")}`
    : "";

  return [
    "---",
    `title: ${page.title}`,
    `description: ${page.description}`,
    "---",
    "",
    `# ${page.h1}`,
    "",
    sectionBlocks
  ].join("\n") + faqBlock + "\n";
}

export function renderPageHtml(page: PageSchema, language = "en"): string {
  const sections = page.sections
    .map(
      (section) => `
    <section>
      <h2>${escapeHtml(section.heading)}</h2>
      <p>${escapeHtml(section.content)}</p>
    </section>`
    )
    .join("\n");

  const faq = page.faq.length
    ? `
    <section>
      <h2>FAQ</h2>
      ${page.faq
        .map(
          (item) => `
      <article>
        <h3>${escapeHtml(item.question)}</h3>
        <p>${escapeHtml(item.answer)}</p>
      </article>`
        )
        .join("\n")}
    </section>`
    : "";

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
  </head>
  <body>
    <main>
      <h1>${escapeHtml(page.h1)}</h1>
      ${sections}
      ${faq}
    </main>
  </body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
