import fs from "node:fs";
import path from "node:path";
import type { PageExportBundle } from "@seo-localization/shared";

export function writeBundleToDirectory(bundle: PageExportBundle, outputRoot: string): string {
  fs.mkdirSync(outputRoot, { recursive: true });

  for (const file of bundle.files) {
    const targetPath = path.join(outputRoot, file.path);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.content, "utf8");
  }

  for (const [language, sitemap] of Object.entries(bundle.sitemapByLanguage)) {
    const sitemapPath = path.join(outputRoot, `sitemap.${language}.xml`);
    fs.mkdirSync(path.dirname(sitemapPath), { recursive: true });
    fs.writeFileSync(sitemapPath, sitemap, "utf8");
  }

  return outputRoot;
}
