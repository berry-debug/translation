import { buildServer } from "./app.js";
import { config } from "./config.js";

const server = await buildServer();

try {
  await server.listen({ port: config.port, host: config.host });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
