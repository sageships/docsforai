import type { z } from 'zod';

import { EnvSchema } from './schemas';

/**
 * Environment variable validation via zod.
 * Validates all required env vars at startup so the app fails fast
 * with a clear error instead of blowing up deep in the call stack.
 */

const _EnvConfigSchema = EnvSchema.transform((env) => ({
  clerkPublishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  clerkSecretKey: env.CLERK_SECRET_KEY,
  databaseUrl: env.DATABASE_URL,
  nodeEnv: env.NODE_ENV,
}));

export type EnvConfig = z.infer<typeof _EnvConfigSchema>;

/**
 * Validated, typed environment configuration.
 * Import this instead of accessing `process.env` directly in application code.
 *
 * @throws {Error} if any required environment variable is missing.
 */
export function getEnvConfig(): EnvConfig {
  const result = _EnvConfigSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Missing or invalid environment variables:\n${issues}\n\nCheck your .env.local file or deployment environment.`,
    );
  }

  return result.data;
}

/**
 * Returns true when running in production.
 */
export function isProduction(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

/**
 * Returns true when running in development.
 */
export function isDevelopment(): boolean {
  return process.env['NODE_ENV'] !== 'production' && process.env['NODE_ENV'] !== 'test';
}
