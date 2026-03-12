import type { FastifyInstance } from "fastify";
import { store } from "../store.js";

export async function projectRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/overview", async () => store.getOverview());

  server.get("/api/projects", async () => store.listProjects());

  server.post("/api/projects", async (request, reply) => {
    const body = request.body as {
      name?: string;
      sourceLanguage?: string;
      targetLanguages?: string[];
      baseUrl?: string;
    };

    if (!body?.name || !body.baseUrl) {
      return reply.code(400).send({ message: "name and baseUrl are required." });
    }

    const sourceLanguage = (body.sourceLanguage ?? "en").toLowerCase();
    const targetLanguages = [...new Set((body.targetLanguages ?? []).map((language) => language.toLowerCase()))].filter(
      (language) => language !== sourceLanguage
    );

    const project = store.createProject({
      name: body.name,
      sourceLanguage,
      targetLanguages,
      baseUrl: body.baseUrl
    });

    return reply.code(201).send(project);
  });
}
