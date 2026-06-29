import { NodeResponse } from "./response.js";

export class Router {
  constructor() {
    this.staticRoutes = new Map();
    this.parametricRoutes = [];
  }

  add(method, path, handler) {
    const key = `${method.toUpperCase()} ${path}`;
    if (path.includes(":")) {
      const pattern = path.replace(/:[^/]+/g, "([^/]+)");
      const paramNames = [...path.matchAll(/:([^/]+)/g)].map((m) => m[1]);
      this.parametricRoutes.push({
        method: method.toUpperCase(),
        regex: new RegExp(`^${pattern}$`),
        paramNames,
        handler
      });
    } else {
      this.staticRoutes.set(key, handler);
    }
  }

  async dispatch(request) {
    if (request.method === "POST" && !isTrustedPostRequest(request)) {
      return NodeResponse.json({
        status: "error",
        error: { code: "csrf_rejected", message: "Cross-site requests are not allowed." }
      }, 403);
    }

    const key = `${request.method} ${request.path}`;
    let handler = this.staticRoutes.get(key);

    if (!handler) {
      for (const route of this.parametricRoutes) {
        if (route.method !== request.method) continue;
        const match = request.path.match(route.regex);
        if (match) {
          request.params = {};
          route.paramNames.forEach((name, i) => {
            request.params[name] = match[i + 1];
          });
          handler = route.handler;
          break;
        }
      }
    }

    if (!handler) {
      return NodeResponse.json({
        status: "not_found",
        message: "Route not found."
      }, 404);
    }

    return handler(request);
  }
}

function isTrustedPostRequest(request) {
  const fetchSite = String(request.header("sec-fetch-site", "")).toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = String(request.header("origin", "")).trim();
  if (!origin) return true;

  const expectedHost = String(request.header("host", "")).trim().toLowerCase();
  try {
    return Boolean(expectedHost) && new URL(origin).host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}
