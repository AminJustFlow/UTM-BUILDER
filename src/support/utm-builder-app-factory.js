import fs from "node:fs";
import path from "node:path";
import baseConfig from "../../config/app.js";
import rules from "../../config/rules.js";
import { Router } from "../http/router.js";
import { NodeResponse } from "../http/response.js";
import { Application } from "./application.js";
import { connectDatabase } from "./database.js";
import { HttpClient } from "./http-client.js";
import { loadEnvFile } from "./env-loader.js";
import { Logger } from "./logger.js";
import { MigrationRunner } from "./migration-runner.js";
import { AppLoginController } from "../controllers/app-login-controller.js";
import { UtmBuilderController } from "../controllers/utm-builder-controller.js";
import { UtmLibraryController } from "../controllers/utm-library-controller.js";
import { UtmImportController } from "../controllers/utm-import-controller.js";
import { GeneratedLinkRepository } from "../repositories/generated-link-repository.js";
import { RequestRepository } from "../repositories/request-repository.js";
import { AppSessionAuthService } from "../services/app-session-auth-service.js";
import { BitlyService } from "../services/bitly-service.js";
import { FingerprintService } from "../services/fingerprint-service.js";
import { LinkGenerationService } from "../services/link-generation-service.js";
import { QrCodeService } from "../services/qr-code-service.js";
import { RequestNormalizer } from "../services/request-normalizer.js";
import { RulesService } from "../services/rules-service.js";
import { UrlService } from "../services/url-service.js";
import { UtmIntelligenceService } from "../services/utm-intelligence-service.js";
import { UtmLibraryEditorService } from "../services/utm-library-editor-service.js";
import { UtmLibraryService } from "../services/utm-library-service.js";
import { UtmCsvImportService } from "../services/utm-csv-import-service.js";

export async function createUtmBuilderApplication(projectRoot) {
  loadEnvFile(path.join(projectRoot, ".env"));
  const config = resolveConfig(projectRoot);
  process.env.TZ = config.app.timezone;

  if (config.database.client === "sqlite") {
    fs.mkdirSync(path.dirname(config.database.path), { recursive: true });
  }
  fs.mkdirSync(path.dirname(config.logging.path), { recursive: true });

  const logger = new Logger(config.logging.path, config.app.debug);
  const database = await connectDatabase(config.database);
  const migrationRunner = new MigrationRunner(
    database,
    path.join(projectRoot, "database", config.database.client === "postgres" ? "utm-builder-migrations-pg" : "utm-builder-migrations")
  );
  await migrationRunner.migrate();

  const requestRepository = new RequestRepository(database);
  const generatedLinkRepository = new GeneratedLinkRepository(database);
  const rulesService = new RulesService(rules);
  const urlService = new UrlService();
  const fingerprintService = new FingerprintService();
  const requestNormalizer = new RequestNormalizer(
    rulesService,
    urlService,
    config.app.confidenceThreshold
  );
  const linkGenerationService = new LinkGenerationService({
    generatedLinkRepository,
    bitlyService: new BitlyService(new HttpClient(), config.bitly),
    qrCodeService: new QrCodeService(config.qr),
    logger
  });
  const utmLibraryEditorService = new UtmLibraryEditorService({
    requestRepository,
    requestNormalizer,
    fingerprintService,
    linkGenerationService,
    generatedLinkRepository
  });
  const utmIntelligenceService = new UtmIntelligenceService({
    projectRoot,
    rulesService,
    generatedLinkRepository
  });
  const utmLibraryService = new UtmLibraryService(requestRepository, { logger });
  const utmCsvImportService = new UtmCsvImportService({
    requestRepository,
    generatedLinkRepository,
    fingerprintService,
    urlService
  });
  const utmBuilderController = new UtmBuilderController({
    utmLibraryEditorService,
    utmLibraryService,
    rulesService,
    requestNormalizer,
    utmIntelligenceService,
    standalone: true
  });
  const utmLibraryController = new UtmLibraryController({
    utmLibraryService,
    utmLibraryEditorService,
    rulesService,
    utmIntelligenceService,
    standalone: true
  });
  const utmImportController = new UtmImportController({ utmCsvImportService });
  const auth = new AppSessionAuthService({
    enabled: config.libraryAuth.enabled,
    username: config.libraryAuth.username,
    password: config.libraryAuth.password,
    realm: config.libraryAuth.realm,
    cookieSecret: config.authCookieSecret
  });
  const login = new AppLoginController({ appSessionAuthService: auth, defaultPath: "/new" });
  const router = new Router();
  const protect = (handler) => async (request) => {
    if (!auth.enabled || auth.isAuthenticated(request)) return handler(request);
    if (request.method === "GET" && !request.path.endsWith(".json") && !request.path.endsWith(".csv")) {
      return NodeResponse.redirect(`/login?${new URLSearchParams({ return_to: request.path }).toString()}`);
    }
    return NodeResponse.json({ status: "error", error: { code: "auth_required", message: "Sign in is required." } }, 401);
  };

  router.add("GET", "/", () => NodeResponse.redirect("/new"));
  router.add("GET", "/health", () => NodeResponse.json({ status: "ok", app: "utm-builder" }));
  router.add("GET", "/login", (request) => login.handleHtml(request));
  router.add("POST", "/login", (request) => login.handleLogin(request));
  router.add("POST", "/logout", (request) => login.handleLogout(request));
  router.add("GET", "/new", protect((request) => utmBuilderController.handleHtml(request)));
  router.add("POST", "/new", protect((request) => utmBuilderController.handleCreate(request)));
  router.add("POST", "/new/preview.json", protect((request) => utmBuilderController.handlePreview(request)));
  for (const [route, handler] of [
    ["metadata", "handleMetadata"], ["suggestions", "handleSuggestions"],
    ["counts", "handleCounts"], ["history", "handleHistory"],
    ["last-year", "handleLastYear"], ["combo-stats", "handleComboStats"],
    ["context", "handleContext"]
  ]) {
    router.add("GET", `/new/utm-intelligence/${route}.json`, protect((request) => utmBuilderController[handler](request)));
  }
  router.add("GET", "/utms", protect((request) => utmLibraryController.handleHtml(request)));
  router.add("GET", "/utms.json", protect((request) => utmLibraryController.handleJson(request)));
  router.add("GET", "/utms.csv", protect((request) => utmLibraryController.handleCsv(request)));
  router.add("POST", "/utms/delete", protect((request) => utmLibraryController.handleDelete(request)));
  router.add("GET", "/imports", protect(() => utmImportController.handleHtml()));
  router.add("POST", "/imports", protect((request) => utmImportController.handleImport(request)));

  return new Application(router, migrationRunner, config, {
    start: async () => {},
    stop: async () => database.close?.()
  }, { logger, slowRequestMs: config.app.slowRequestMs });
}

function resolveConfig(projectRoot) {
  const databaseClient = String(process.env.DATABASE_CLIENT ?? baseConfig.database.client ?? "sqlite").toLowerCase() === "postgres" ? "postgres" : "sqlite";
  return {
    app: {
      name: "JF UTM Builder",
      port: Number(process.env.PORT ?? process.env.UTM_BUILDER_PORT ?? process.env.APP_PORT ?? 3000),
      timezone: process.env.DEFAULT_TIMEZONE ?? baseConfig.app.timezone,
      confidenceThreshold: Number(process.env.PARSER_CONFIDENCE_THRESHOLD ?? baseConfig.app.confidenceThreshold),
      debug: parseBoolean(process.env.APP_DEBUG, baseConfig.app.debug),
      slowRequestMs: Number(process.env.SLOW_REQUEST_MS ?? baseConfig.app.slowRequestMs)
    },
    database: {
      client: databaseClient,
      path: path.resolve(projectRoot, process.env.DATABASE_PATH ?? "storage/database/app.sqlite"),
      url: process.env.DATABASE_URL ?? process.env.POSTGRES_DATABASE_URL ?? baseConfig.database.url,
      poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30000),
      sslEnabled: parseBoolean(process.env.DATABASE_SSL_ENABLED, baseConfig.database.sslEnabled),
      sslRejectUnauthorized: parseBoolean(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED, baseConfig.database.sslRejectUnauthorized)
    },
    logging: { path: path.resolve(projectRoot, process.env.UTM_BUILDER_LOG_PATH ?? "storage/logs/utm-builder.log") },
    bitly: {
      accessToken: process.env.BITLY_ACCESS_TOKEN ?? "",
      domain: process.env.BITLY_DOMAIN ?? baseConfig.bitly.domain,
      groupGuid: process.env.BITLY_GROUP_GUID ?? "",
      apiBase: baseConfig.bitly.apiBase,
      timeoutMs: Number(process.env.BITLY_TIMEOUT_MS ?? baseConfig.bitly.timeoutMs)
    },
    qr: { baseUrl: process.env.QR_BASE_URL ?? baseConfig.qr.baseUrl, size: process.env.QR_SIZE ?? baseConfig.qr.size },
    libraryAuth: {
      enabled: parseBoolean(process.env.LIBRARY_AUTH_ENABLED, baseConfig.libraryAuth.enabled),
      username: process.env.LIBRARY_AUTH_USERNAME ?? "",
      password: process.env.LIBRARY_AUTH_PASSWORD ?? "",
      realm: process.env.LIBRARY_AUTH_REALM ?? baseConfig.libraryAuth.realm
    },
    authCookieSecret: process.env.TRACKING_SECRET_ENCRYPTION_KEY ?? ""
  };
}

function parseBoolean(value, fallback) {
  if (value === undefined) return Boolean(fallback);
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
