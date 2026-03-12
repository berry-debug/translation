import type { HreflangEntry } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemapDocument(
  currentUrl: string,
  alternates: HreflangEntry[]
): string {
  const alternateLinks = alternates
    .map(
      (entry) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(entry.hreflang)}" href="${escapeXml(entry.href)}" />`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${escapeXml(currentUrl)}</loc>
${alternateLinks}
  </url>
</urlset>
`;
}

