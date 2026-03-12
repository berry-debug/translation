import type { FastifyInstance } from "fastify";
import {
  buildSchemaFromJsonDocument,
  extractJsonTextBlocks,
  parseJsonDocument
} from "../services/json-document.js";
import { parsePageInput } from "../services/parser.js";
import { store } from "../store.js";

export async function pageRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/pages", async (request) => {
    const query = request.query as { projectId?: string };
    return store.listPages(query.projectId);
  });

  server.get("/api/pages/:pageId", async (request, reply) => {
    const params = request.params as { pageId: string };
    const page = store.getPage(params.pageId);
    if (!page) {
      return reply.code(404).send({ message: "Page not found." });
    }

    return page;
  });

  server.post("/api/pages", async (request, reply) => {
    const body = request.body as {
      projectId?: string;
      sourceLanguage?: string;
      slug?: string;
      title?: string;
      description?: string;
      content?: string;
      schema?: Parameters<typeof parsePageInput>[0]["schema"];
    };

    if (!body?.projectId) {
      return reply.code(400).send({ message: "projectId is required." });
    }

    const project = store.getProject(body.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const sourceDocument = !body.schema && body.content ? parseJsonDocument(body.content) : undefined;
    const schema = sourceDocument
      ? buildSchemaFromJsonDocument(body.slug ?? body.title ?? "page.json", sourceDocument.value)
      : parsePageInput({
          slug: body.slug,
          title: body.title,
          description: body.description,
          content: body.content,
          schema: body.schema
        });

    const page = store.createPage({
      projectId: project.id,
      sourceLanguage: body.sourceLanguage ?? project.sourceLanguage,
      rawContent: body.content,
      extractedTextBlocks: sourceDocument ? extractJsonTextBlocks(sourceDocument.value) : undefined,
      sourceDocument,
      schema
    });

    return reply.code(201).send(page);
  });

  server.patch("/api/pages/:pageId", async (request, reply) => {
    const params = request.params as { pageId: string };
    const body = request.body as {
      slug?: string;
      title?: string;
      description?: string;
      content?: string;
      schema?: Parameters<typeof parsePageInput>[0]["schema"];
    };

    const page = store.getPage(params.pageId);
    if (!page) {
      return reply.code(404).send({ message: "Page not found." });
    }

    const sourceDocument = !body.schema && body.content ? parseJsonDocument(body.content) : undefined;
    const schema = sourceDocument
      ? buildSchemaFromJsonDocument(body.slug ?? body.title ?? page.schema.slug, sourceDocument.value)
      : parsePageInput({
          slug: body.slug,
          title: body.title,
          description: body.description,
          content: body.content,
          schema: body.schema
        });

    return store.saveSourcePage(
      page.id,
      schema,
      sourceDocument,
      sourceDocument ? extractJsonTextBlocks(sourceDocument.value) : undefined
    );
  });

  server.put("/api/pages/:pageId/translations/:language", async (request, reply) => {
    const params = request.params as { pageId: string; language: string };
    const body = request.body as {
      schema?: Parameters<typeof parsePageInput>[0]["schema"];
      document?: unknown;
    };

    const page = store.getPage(params.pageId);
    if (!page) {
      return reply.code(404).send({ message: "Page not found." });
    }

    const project = store.getProject(page.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (!project.targetLanguages.includes(params.language)) {
      return reply.code(400).send({ message: "Language is not enabled for this project." });
    }

    if (page.sourceDocument?.kind === "json") {
      if (typeof body?.document === "undefined") {
        return reply.code(400).send({ message: "document is required for JSON document pages." });
      }

      const document = {
        kind: "json" as const,
        value: body.document
      };
      const schema = buildSchemaFromJsonDocument(
        page.sourceReference?.relativePath ?? `${page.schema.slug}.json`,
        document.value
      );

      return store.saveTranslation(page.id, params.language, schema, document);
    }

    if (!body?.schema) {
      return reply.code(400).send({ message: "schema is required." });
    }

    const schema = parsePageInput({ schema: body.schema });
    return store.saveTranslation(page.id, params.language, schema);
  });

  server.delete("/api/pages/:pageId", async (request, reply) => {
    const params = request.params as { pageId: string };
    const page = store.getPage(params.pageId);
    if (!page) {
      return reply.code(404).send({ message: "Page not found." });
    }

    store.deletePage(page.id);
    return reply.code(204).send();
  });

  server.delete("/api/projects/:projectId/pages", async (request, reply) => {
    const params = request.params as { projectId: string };
    const project = store.getProject(params.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const deletedCount = store.clearProjectPages(project.id);
    return {
      projectId: project.id,
      deletedCount
    };
  });
}
