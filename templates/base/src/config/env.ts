import { z } from "zod";

const envSchema = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/** The environment variables this app reads, after validation. */
export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw environment variables, so a missing or malformed value fails at startup instead of mid-request.
 * @param source the variables to read, usually `process.env`
 */
export const parseEnv = (source: Readonly<Record<string, string | undefined>>): Env =>
  envSchema.parse(source);

/** The validated environment. Import this instead of reading `process.env` directly. */
export const env = parseEnv(process.env);
