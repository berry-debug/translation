import { buildExportBundle } from "@seo-localization/shared";
import type { FastifyInstance } from "fastify";
import { defaultExportFormats } from "../repositories/memory-store.js";
import {
  buildTranslationPrompt,
  translateJsonDocument,
  translatePageSchema
} from "../services/translation.js";
import { store } from "../store.js";

export async function translationRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/translate/page", async (request, reply) => {
    const body = request.body as {
      pageId?: string;
      targetLanguage?: string;
    };

    if (!body?.pageId || !body.targetLanguage) {
      return reply.code(400).send({ message: "pageId and targetLanguage are required." });
    }

    const page = store.getPage(body.pageId);
    if (!page) {
      return reply.code(404).send({ message: "Page not found." });
    }

    const project = store.getProject(page.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (!project.targetLanguages.includes(body.targetLanguage)) {
      return reply.code(400).send({ message: "Language is not enabled for this project." });
    }

    const locks = store.listKeywordLocks(project.id);
    try {
      if (page.sourceDocument?.kind === "json") {
        const translated = await translateJsonDocument(
          page.sourceDocument,
          page.sourceReference?.relativePath ?? page.schema.slug,
          body.targetLanguage,
          locks
        );
        const updatedPage = store.saveTranslation(page.id, body.targetLanguage, translated.schema, translated.document);

        return {
          prompt: translated.prompt,
          page: updatedPage
        };
      }

      const schema = await translatePageSchema(page.schema, body.targetLanguage, locks);
      const updatedPage = store.saveTranslation(page.id, body.targetLanguage, schema);

      return {
        prompt: buildTranslationPrompt(page.schema, body.targetLanguage, locks),
        page: updatedPage
      };
    } catch (error) {
      const message = `Failed to translate ${body.targetLanguage.toUpperCase()} for "${page.schema.title}": ${toErrorMessage(error)}`;
      request.log.error({ err: error, pageId: page.id, language: body.targetLanguage }, message);
      return reply.code(502).send({ message });
    }
  });

  server.post("/api/translate/page/:pageId/all", async (request, reply) => {
    const params = request.params as { pageId: string };
    const page = store.getPage(params.pageId);
    if (!page) {
      return reply.code(404).send({ message: "Page not found." });
    }

    const project = store.getProject(page.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const locks = store.listKeywordLocks(project.id);
    try {
      await Promise.all(
        project.targetLanguages.map(async (language) => {
          if (page.sourceDocument?.kind === "json") {
            const translated = await translateJsonDocument(
              page.sourceDocument,
              page.sourceReference?.relativePath ?? page.schema.slug,
              language,
              locks
            );
            store.saveTranslation(page.id, language, translated.schema, translated.document);
            return;
          }

          const schema = await translatePageSchema(page.schema, language, locks);
          store.saveTranslation(page.id, language, schema);
        })
      );
    } catch (error) {
      const message = `Failed to translate all languages for "${page.schema.title}": ${toErrorMessage(error)}`;
      request.log.error({ err: error, pageId: page.id, languages: project.targetLanguages }, message);
      return reply.code(502).send({ message });
    }

    const updatedPage = store.getPage(page.id);
    if (!updatedPage) {
      return reply.code(404).send({ message: "Page not found after translation." });
    }

    return {
      projectId: project.id,
      pageId: updatedPage.id,
      translatedLanguages: project.targetLanguages,
      page: updatedPage
    };
  });

  server.post("/api/generate/project/:projectId", async (request, reply) => {
    const params = request.params as { projectId: string };
    const body = request.body as { formats?: Array<"markdown" | "json" | "html"> } | undefined;

    const project = store.getProject(params.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const pages = store.listPages(project.id);
    const bundles = pages.map((page) =>
      store.saveExport(buildExportBundle(project, page, body?.formats ?? defaultExportFormats))
    );

    return {
      projectId: project.id,
      generatedAt: new Date().toISOString(),
      pageCount: bundles.length,
      bundles
    };
  });

  server.post("/api/run/project/:projectId", async (request, reply) => {
    const params = request.params as { projectId: string };
    const body = request.body as
      | { formats?: Array<"markdown" | "json" | "html">; languages?: string[] }
      | undefined;

    const project = store.getProject(params.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const selectedLanguages = body?.languages?.length
      ? [...new Set(body.languages.map((language) => language.toLowerCase()))]
      : project.targetLanguages;

    if (!selectedLanguages.length) {
      return reply.code(400).send({ message: "At least one target language is required." });
    }

    const invalidLanguages = selectedLanguages.filter((language) => !project.targetLanguages.includes(language));
    if (invalidLanguages.length) {
      return reply.code(400).send({ message: `Unsupported languages: ${invalidLanguages.join(", ")}` });
    }

    const pages = store.listPages(project.id);
    const locks = store.listKeywordLocks(project.id);
    const translatedPages = [];

    try {
      for (const page of pages) {
        await Promise.all(
          selectedLanguages.map(async (language) => {
            if (page.sourceDocument?.kind === "json") {
              const translated = await translateJsonDocument(
                page.sourceDocument,
                page.sourceReference?.relativePath ?? page.schema.slug,
                language,
                locks
              );
              store.saveTranslation(page.id, language, translated.schema, translated.document);
              return;
            }

            const schema = await translatePageSchema(page.schema, language, locks);
            store.saveTranslation(page.id, language, schema);
          })
        );

        const updatedPage = store.getPage(page.id);
        if (!updatedPage) {
          throw new Error(`Page ${page.id} disappeared after translation.`);
        }

        translatedPages.push(updatedPage);
      }
    } catch (error) {
      const message = `Project translation failed: ${toErrorMessage(error)}`;
      request.log.error(
        { err: error, projectId: project.id, pageCount: pages.length, languages: selectedLanguages },
        message
      );
      return reply.code(502).send({ message });
    }

    const bundles = translatedPages.map((page) =>
      store.saveExport(buildExportBundle(project, page, body?.formats ?? defaultExportFormats))
    );

    return {
      projectId: project.id,
      sourceLanguage: project.sourceLanguage,
      targetLanguages: selectedLanguages,
      pageCount: pages.length,
      translatedCount: translatedPages.length * selectedLanguages.length,
      exportCount: bundles.length,
      generatedAt: new Date().toISOString(),
      pages: translatedPages,
      bundles
    };
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Unknown translation error.";
}
