import type { FastifyInstance } from "fastify";
import { getSystemStatus, updateSystemConfig } from "../config.js";

export async function systemRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/system/status", async () => getSystemStatus());

  server.post("/api/system/config", async (request, reply) => {
    const body = request.body as {
      translationProvider?: string;
      apiKey?: string;
      model?: string;
      apiBaseUrl?: string;
      clearApiKey?: boolean;
    };

    const provider = body.translationProvider;
    if (
      provider &&
      provider !== "openai" &&
      provider !== "openrouter" &&
      provider !== "siliconflow" &&
      provider !== "gemini" &&
      provider !== "custom-compatible" &&
      provider !== "mock"
    ) {
      return reply.code(400).send({
        message:
          "translationProvider must be 'openai', 'openrouter', 'siliconflow', 'gemini', 'custom-compatible', or 'mock'."
      });
    }

    return updateSystemConfig({
      translationProvider: provider as
        | "openai"
        | "openrouter"
        | "siliconflow"
        | "gemini"
        | "custom-compatible"
        | "mock"
        | undefined,
      apiKey: body.apiKey,
      model: body.model,
      apiBaseUrl: body.apiBaseUrl,
      clearApiKey: body.clearApiKey
    });
  });
}
