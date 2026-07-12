import { config } from "dotenv";
import { z } from "zod";

config();

const EnvSchema = z.object({
  ARCONT_API_HOST: z.string().default("0.0.0.0"),
  ARCONT_API_PORT: z.coerce.number().default(4000),
  ARCONT_API_ORIGIN: z.string().default("http://localhost:3000"),
  ARCONT_DEFAULT_COUNTRY: z.string().default("MX"),
  ARCONT_DEFAULT_LOCALE: z.string().default("es-MX"),
  ARCONT_DEFAULT_CURRENCY: z.string().default("MXN")
});

export const env = EnvSchema.parse(process.env);
