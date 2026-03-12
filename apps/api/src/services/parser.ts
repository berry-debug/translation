import { normalizePageSchema, slugify, type PageSchema } from "@seo-localization/shared";

interface ParsePageInput {
  slug?: string;
  title?: string;
  description?: string;
  content?: string;
  schema?: PageSchema;
}

export function parsePageInput(input: ParsePageInput): PageSchema {
  if (input.schema) {
    return normalizePageSchema(input.schema);
  }

  if (!input.content) {
    throw new Error("Page content or schema is required.");
  }

  return parseMarkdownPage(input.content, input.slug, input.title, input.description);
}

function parseMarkdownPage(
  content: string,
  explicitSlug?: string,
  explicitTitle?: string,
  explicitDescription?: string
): PageSchema {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n*/);
  const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";
  const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content;
  const frontmatterMap = Object.fromEntries(
    frontmatter
      .split(/\r?\n/)
      .map((line) => line.replace(/\r$/, ""))
      .map((line) => line.match(/^([^:]+):\s*(.+)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1].trim(), match[2].trim()])
  );

  const lines = body.split(/\r?\n/);
  const sections: PageSchema["sections"] = [];
  const faq: PageSchema["faq"] = [];
  let h1 = explicitTitle ?? String(frontmatterMap.title ?? "");
  let currentSection: { heading: string; lines: string[] } | null = null;
  let currentFaq: { question: string; lines: string[] } | null = null;
  let faqMode = false;

  const flushSection = (): void => {
    if (currentSection) {
      sections.push({
        heading: currentSection.heading,
        content: currentSection.lines.join(" ").trim()
      });
      currentSection = null;
    }
  };

  const flushFaq = (): void => {
    if (currentFaq) {
      faq.push({
        question: currentFaq.question,
        answer: currentFaq.lines.join(" ").trim()
      });
      currentFaq = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      h1 = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("## ")) {
      flushFaq();
      flushSection();

      const heading = line.slice(3).trim();
      faqMode = /^(faq|frequently asked questions)$/i.test(heading);
      if (!faqMode) {
        currentSection = { heading, lines: [] };
      }
      continue;
    }

    if (faqMode && line.startsWith("### ")) {
      flushFaq();
      currentFaq = { question: line.slice(4).trim(), lines: [] };
      continue;
    }

    if (faqMode) {
      if (currentFaq && line.trim()) {
        currentFaq.lines.push(line.trim());
      }
      continue;
    }

    if (currentSection && line.trim()) {
      currentSection.lines.push(line.trim());
    }
  }

  flushFaq();
  flushSection();

  const title = explicitTitle ?? String(frontmatterMap.title ?? h1);
  const description =
    explicitDescription ??
    String(frontmatterMap.description ?? sections[0]?.content.slice(0, 160) ?? h1);

  return normalizePageSchema({
    slug: explicitSlug ?? slugify(h1 || title),
    title,
    description,
    h1: h1 || title,
    sections,
    faq
  });
}
