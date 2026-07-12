import { config } from "dotenv";
import { z } from "zod";

config();

const EnvSchema = z.object({
  ARCONT_API_HOST: z.string().default("0.0.0.0"),
  ARCONT_API_PORT: z.coerce.number().default(4000),
  ARCONT_API_ORIGIN: z.string().default("http://localhost:3000"),
  ARCONT_AUTH_JWT_SECRET: z.string().default("change-this-secret"),
  ARCONT_AUTH_ACCESS_TTL_SECONDS: z.coerce.number().default(3600),
  ARCONT_DATA_DRIVER: z.enum(["memory", "postgres"]).default("memory"),
  ARCONT_DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/arcont"),
  ARCONT_DEFAULT_COUNTRY: z.string().default("MX"),
  ARCONT_DEFAULT_LOCALE: z.string().default("es-MX"),
  ARCONT_DEFAULT_CURRENCY: z.string().default("MXN")
});

export const env = EnvSchema.parse(process.env);
