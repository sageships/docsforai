import pino from 'pino';

/**
 * Structured application logger powered by pino.
 * Outputs JSON in production, pretty-printed in development.
 *
 * Usage:
 *   import logger from '@/lib/logger';
 *   logger.info({ scanId }, 'Scan started');
 *   logger.error({ err, url }, 'Crawl failed');
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

export default logger;
