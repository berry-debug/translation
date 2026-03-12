import cors from "@fastify/cors";
import Fastify from "fastify";
import { exportRoutes } from "./routes/exports.js";
import { importRoutes } from "./routes/imports.js";
import { keywordRoutes } from "./routes/keywords.js";
import { pageRoutes } from "./routes/pages.js";
import { projectRoutes } from "./routes/projects.js";
import { systemRoutes } from "./routes/system.js";
import { translationRoutes } from "./routes/translation.js";

export async function buildServer() {
  const server = Fastify({ logger: true });

  await server.register(cors, { origin: true });

  server.get("/health", async () => ({ ok: true }));

  await server.register(projectRoutes);
  await server.register(importRoutes);
  await server.register(pageRoutes);
  await server.register(keywordRoutes);
  await server.register(systemRoutes);
  await server.register(translationRoutes);
  await server.register(exportRoutes);

  return server;
}
