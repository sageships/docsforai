/**
 * Environment variable validation.
 * Validates all required env vars at startup so the app fails fast
 * with a clear error instead of blowing up deep in the call stack.
 */

interface EnvConfig {
  /** Clerk publishable key for client-side auth. */
  clerkPublishableKey: string;
  /** Clerk secret key for server-side auth. */
  clerkSecretKey: string;
  /** Database connection URL. */
  databaseUrl: string;
  /** Current Node environment. */
  nodeEnv: 'development' | 'production' | 'test';
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Check your .env.local file or deployment environment.`,
    );
  }
  return value;
}

function getNodeEnv(): EnvConfig['nodeEnv'] {
  const raw = process.env['NODE_ENV'] ?? 'development';
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

/**
 * Validated, typed environment configuration.
 * Import this instead of accessing `process.env` directly in application code.
 *
 * @throws {Error} if any required environment variable is missing.
 */
export function getEnvConfig(): EnvConfig {
  return {
    clerkPublishableKey: getRequiredEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
    clerkSecretKey: getRequiredEnv('CLERK_SECRET_KEY'),
    databaseUrl: getRequiredEnv('DATABASE_URL'),
    nodeEnv: getNodeEnv(),
  };
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
