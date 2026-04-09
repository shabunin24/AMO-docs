import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .default("10000")
    .transform((value) => Number(value))
    .pipe(z.number().int().positive()),
  AMO_CLIENT_ID: z.string().default(""),
  AMO_CLIENT_SECRET: z.string().default(""),
  AMO_REDIRECT_URI: z.string().default(""),
  AMO_SUBDOMAIN: z.string().default(""),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// parsed.success гарантирован выше через process.exit(1)
export const config = parsed.data!;
