import { buildExportBundle, type ExportFormat } from "@seo-localization/shared";
import type { FastifyInstance } from "fastify";
import path from "node:path";
import { writeBundleToDirectory } from "../services/export-writer.js";
import { store } from "../store.js";

export async function exportRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/exports/:projectId", async (request, reply) => {
    const params = request.params as { projectId: string };

    if (!store.getProject(params.projectId)) {
      return reply.code(404).send({ message: "Project not found." });
    }

    return store.listExports(params.projectId);
  });

  server.post("/api/exports/:projectId/save", async (request, reply) => {
    const params = request.params as { projectId: string };
    const body = request.body as {
      targetPath?: string;
      formats?: ExportFormat[];
    };

    const project = store.getProject(params.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const pages = store.listPages(project.id);
    if (!pages.length) {
      return reply.code(400).send({ message: "No pages available for export." });
    }

    const fallbackRoot =
      pages.find((page) => page.sourceReference?.rootPath)?.sourceReference?.rootPath ??
      (() => {
        const absolutePath = pages.find((page) => page.sourceReference?.absolutePath)?.sourceReference?.absolutePath;
        return absolutePath ? path.dirname(absolutePath) : undefined;
      })();
    const targetPath = body.targetPath?.trim() || fallbackRoot;

    if (!targetPath) {
      return reply.code(400).send({ message: "targetPath is required when no import root is available." });
    }

    const outputRoot = path.resolve(targetPath);
    const bundles = pages.map((page) => buildExportBundle(project, page, body.formats));
    const writtenRoots = bundles.map((bundle) =>
      writeBundleToDirectory(bundle, path.join(outputRoot, bundle.slug))
    );

    return {
      projectId: project.id,
      targetPath: outputRoot,
      bundleCount: bundles.length,
      writtenRoots
    };
  });
}
