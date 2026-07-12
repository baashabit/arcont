import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

await app.listen({
  host: env.ARCONT_API_HOST,
  port: env.ARCONT_API_PORT
});
