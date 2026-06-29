import { NodeResponse } from "../http/response.js";

export class Application {
  constructor(router, migrationRunner, config, lifecycle = {}, options = {}) {
    this.router = router;
    this.migrationRunner = migrationRunner;
    this.config = config;
    this.lifecycle = lifecycle;
    this.logger = options.logger ?? null;
    this.slowRequestMs = Math.max(1, Number(options.slowRequestMs) || 1500);
  }

  async handle(request) {
    const startedAt = Date.now();
    try {
      const response = await this.router.dispatch(request);
      this.logRequest(request, response, Date.now() - startedAt);
      return withDurationHeader(response, Date.now() - startedAt);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      this.logger?.error?.("Request handling failed.", {
        method: request.method,
        path: request.path,
        query: request.query,
        duration_ms: durationMs,
        error: error?.message ?? String(error ?? "Unknown error")
      });
      return NodeResponse.text("Internal Server Error", 500, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Request-Duration-Ms": String(durationMs)
      });
    }
  }

  async runMigrations() {
    await this.migrationRunner.migrate();
  }

  async start() {
    if (typeof this.lifecycle.start === "function") {
      await this.lifecycle.start();
    }
  }

  async stop() {
    if (typeof this.lifecycle.stop === "function") {
      await this.lifecycle.stop();
    }
  }

  logRequest(request, response, durationMs) {
    if (!this.logger) {
      return;
    }
    const context = {
      method: request.method,
      path: request.path,
      query: request.query,
      status_code: response?.statusCode ?? 200,
      duration_ms: durationMs
    };
    if (durationMs >= this.slowRequestMs) {
      this.logger.warning("Slow request detected.", context);
      return;
    }
    this.logger.debug("Request timing.", context);
  }
}

function withDurationHeader(response, durationMs) {
  return new NodeResponse(
    response.statusCode,
    {
      ...response.headers,
      "X-Request-Duration-Ms": String(durationMs)
    },
    response.body
  );
}
