import type { FastifyInstance } from "fastify";
import {
  createImportedPageDraft,
  prepareUploadedImport,
  scanFolderImport,
  scanGitImport,
  type ImportScanResult,
  type UploadedImportFile
} from "../services/importer.js";
import { store } from "../store.js";

export async function importRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/import/files", async (request, reply) => {
    const body = request.body as {
      projectId?: string;
      files?: UploadedImportFile[];
    };

    if (!body?.projectId || !Array.isArray(body.files) || body.files.length === 0) {
      return reply.code(400).send({ message: "projectId and files are required." });
    }

    const project = store.getProject(body.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    return reply.code(201).send(importIntoProject(project.id, project.sourceLanguage, prepareUploadedImport(body.files)));
  });

  server.post("/api/import/folder", async (request, reply) => {
    const body = request.body as {
      projectId?: string;
      folderPath?: string;
    };

    if (!body?.projectId || !body.folderPath?.trim()) {
      return reply.code(400).send({ message: "projectId and folderPath are required." });
    }

    const project = store.getProject(body.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    return reply.code(201).send(importIntoProject(project.id, project.sourceLanguage, scanFolderImport(body.folderPath)));
  });

  server.post("/api/import/git", async (request, reply) => {
    const body = request.body as {
      projectId?: string;
      repoUrl?: string;
      branch?: string;
    };

    if (!body?.projectId || !body.repoUrl?.trim()) {
      return reply.code(400).send({ message: "projectId and repoUrl are required." });
    }

    const project = store.getProject(body.projectId);
    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    return reply
      .code(201)
      .send(importIntoProject(project.id, project.sourceLanguage, scanGitImport({ repoUrl: body.repoUrl, branch: body.branch })));
  });
}

function importIntoProject(projectId: string, sourceLanguage: string, scanResult: ImportScanResult) {
  const importedPages = [];
  const skipped = [...scanResult.skipped];

  for (const file of scanResult.files) {
    const draft = createImportedPageDraft(file);
    if (!draft) {
      skipped.push({
        path: file.relativePath,
        reason: "未提取到可翻译的展示文案"
      });
      continue;
    }

    importedPages.push(
      store.createPage({
        projectId,
        sourceLanguage,
        rawContent: draft.rawContent,
        schema: draft.schema,
        sourceReference: draft.sourceReference,
        extractedTextBlocks: draft.extractedTextBlocks,
        sourceDocument: draft.sourceDocument
      })
    );
  }

  return {
    projectId,
    rootPath: scanResult.rootPath,
    importedCount: importedPages.length,
    skippedCount: skipped.length,
    pages: importedPages,
    skipped
  };
}
