/**
 * Request logger middleware for API route handlers.
 *
 * Wraps a Next.js route handler to automatically:
 * - Generate a requestId (crypto.randomUUID)
 * - Create a child logger scoped to {requestId, method, path}
 * - Log request start at info level
 * - Log response with {statusCode, durationMs} at info level
 * - Log errors at error level with the full error object
 *
 * @example
 *   export const POST = withRequestLogger(async (req) => { ... });
 *
 * @module lib/middleware/request-logger
 */
import logger from "@/lib/logger";

type RouteHandler = (request: Request, context?: unknown) => Promise<Response>;

export function withRequestLogger(handler: RouteHandler): RouteHandler {
  return async (request: Request, context?: unknown): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const url = request?.url ? new URL(request.url) : null;
    const log = logger.child({
      requestId,
      method: request?.method ?? "GET",
      path: url?.pathname ?? "/",
    });
    const start = Date.now();

    log.info("request started");

    try {
      const response = await handler(request, context);
      log.info(
        { statusCode: response.status, durationMs: Date.now() - start },
        "request completed",
      );
      return response;
    } catch (err) {
      log.error({ err, durationMs: Date.now() - start }, "request error");
      throw err;
    }
  };
}
