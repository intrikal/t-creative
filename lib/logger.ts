/**
 * Structured logger — pino singleton for server-side use.
 *
 * - Production: JSON output (consumed by log aggregators)
 * - Development: pretty-printed via pino-pretty
 *
 * Level is controlled by LOG_LEVEL env var (default: "info").
 * Base fields (service, environment) are attached to every log line.
 *
 * @module lib/logger
 */
import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "t-creative",
    environment: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname,service,environment",
      },
    },
  }),
});

export default logger;
