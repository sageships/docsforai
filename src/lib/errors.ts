/**
 * Custom error classes for DocsForAI.
 * These provide typed error handling across the application.
 */

/**
 * Thrown when user-provided input fails validation (e.g., invalid URL).
 */
export class ValidationError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when the crawler fails to fetch or parse a page.
 */
export class CrawlError extends Error {
  public readonly statusCode = 502;
  public readonly url: string;

  constructor(message: string, url: string) {
    super(message);
    this.name = 'CrawlError';
    this.url = url;
    Object.setPrototypeOf(this, CrawlError.prototype);
  }
}

/**
 * Thrown when the scoring pipeline encounters an unexpected state.
 */
export class ScoringError extends Error {
  public readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'ScoringError';
    Object.setPrototypeOf(this, ScoringError.prototype);
  }
}

/**
 * Thrown when a requested resource is not found.
 */
export class NotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Type guard to check if an error has a statusCode property.
 */
export function isAppError(
  err: unknown,
): err is ValidationError | CrawlError | ScoringError | NotFoundError {
  return (
    err instanceof ValidationError ||
    err instanceof CrawlError ||
    err instanceof ScoringError ||
    err instanceof NotFoundError
  );
}

/**
 * Extract a human-readable message from an unknown error.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unknown error occurred';
}
