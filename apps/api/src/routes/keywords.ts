import type { FastifyInstance } from "fastify";
import { store } from "../store.js";

export async function keywordRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/keywords", async (request) => {
    const query = request.query as { projectId?: string };
    return store.listKeywordLocks(query.projectId);
  });

  server.post("/api/keywords", async (request, reply) => {
    const body = request.body as {
      projectId?: string;
      sourceKeyword?: string;
      targetLanguage?: string;
      targetKeyword?: string;
    };

    if (!body?.projectId || !body.sourceKeyword || !body.targetLanguage || !body.targetKeyword) {
      return reply.code(400).send({
        message: "projectId, sourceKeyword, targetLanguage, and targetKeyword are required."
      });
    }

    if (!store.getProject(body.projectId)) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const keywordLock = store.createKeywordLock({
      projectId: body.projectId,
      sourceKeyword: body.sourceKeyword,
      targetLanguage: body.targetLanguage,
      targetKeyword: body.targetKeyword
    });

    return reply.code(201).send(keywordLock);
  });
}

