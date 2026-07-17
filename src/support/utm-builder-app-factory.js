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
import { AccountController } from "../controllers/account-controller.js";
import { SetupConsoleController } from "../controllers/setup-console-controller.js";
import { UserAdminController } from "../controllers/user-admin-controller.js";
import { CampaignStandardsAdminController } from "../controllers/campaign-standards-admin-controller.js";
import { UtmBuilderController } from "../controllers/utm-builder-controller.js";
import { UtmLibraryController } from "../controllers/utm-library-controller.js";
import { UtmImportController } from "../controllers/utm-import-controller.js";
import { GeneratedLinkRepository } from "../repositories/generated-link-repository.js";
import { RequestRepository } from "../repositories/request-repository.js";
import { LinkAuditRepository } from "../repositories/link-audit-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { UtmValueAcknowledgementRepository } from "../repositories/utm-value-acknowledgement-repository.js";
import { ConsistencyNotificationSettingsRepository } from "../repositories/consistency-notification-settings-repository.js";
import { ClientCampaignStandardsRepository } from "../repositories/client-campaign-standards-repository.js";
import { AppSessionAuthService } from "../services/app-session-auth-service.js";
import { SetupConsoleAuthService } from "../services/setup-console-auth-service.js";
import { UserAccountService } from "../services/user-account-service.js";
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
import { SmtpMailer } from "../services/smtp-mailer.js";
import { ConsistencyNotificationService, ConsistencyNotificationScheduler } from "../services/consistency-notification-service.js";
import { ClientCampaignStandardsService } from "../services/client-campaign-standards-service.js";

export async function createUtmBuilderApplication(projectRoot) {
  if (process.env.UTM_BUILDER_SKIP_ENV_FILE !== "1") {
    loadEnvFile(path.join(projectRoot, ".env"));
  }
  const config = resolveConfig(projectRoot);
  if (!config.auth.cookieSecret) {
    throw new Error("TRACKING_SECRET_ENCRYPTION_KEY is required. Set it to a long random value before starting the app.");
  }
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
  const linkAuditRepository = new LinkAuditRepository(database);
  const utmValueAcknowledgementRepository = new UtmValueAcknowledgementRepository(database);
  const notificationSettingsRepository = new ConsistencyNotificationSettingsRepository(database);
  const campaignStandardsRepository = new ClientCampaignStandardsRepository(database);
  const userRepository = new UserRepository(database);
  const userAccountService = new UserAccountService({ userRepository });
  const rulesService = new RulesService(rules);
  const campaignStandardsService = new ClientCampaignStandardsService({
    repository: campaignStandardsRepository,
    rulesService
  });
  await campaignStandardsService.bootstrap();
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
  const utmIntelligenceService = new UtmIntelligenceService({
    projectRoot,
    rulesService,
    generatedLinkRepository,
    requestRepository
  });
  const utmLibraryEditorService = new UtmLibraryEditorService({
    requestRepository,
    requestNormalizer,
    fingerprintService,
    linkGenerationService,
    generatedLinkRepository,
    linkAuditRepository,
    utmIntelligenceService,
    utmValueAcknowledgementRepository
  });
  const utmLibraryService = new UtmLibraryService(requestRepository, { logger });
  const utmCsvImportService = new UtmCsvImportService({
    requestRepository,
    generatedLinkRepository,
    fingerprintService,
    urlService,
    linkAuditRepository
  });
  const utmBuilderController = new UtmBuilderController({
    utmLibraryEditorService,
    utmLibraryService,
    rulesService,
    campaignStandardsService,
    requestNormalizer,
    utmIntelligenceService,
    utmValueAcknowledgementRepository,
    standalone: true
  });
  const utmLibraryController = new UtmLibraryController({
    utmLibraryService,
    utmLibraryEditorService,
    rulesService,
    utmIntelligenceService,
    linkAuditRepository,
    utmValueAcknowledgementRepository,
    standalone: true
  });
  const utmImportController = new UtmImportController({ utmCsvImportService });
  const auth = new AppSessionAuthService({
    userRepository,
    sessionTtlSeconds: config.auth.sessionTtlSeconds,
    cookieSecret: config.auth.cookieSecret
  });
  const setupConsoleAuthService = new SetupConsoleAuthService({
    username: config.setup.username,
    password: config.setup.password,
    cookieSecret: config.auth.cookieSecret
  });
  const login = new AppLoginController({ appSessionAuthService: auth, defaultPath: "/new" });
  const setupConsoleController = new SetupConsoleController({ setupConsoleAuthService, userAccountService });
  const mailer = new SmtpMailer(config.smtp);
  const notificationService = new ConsistencyNotificationService({
    settingsRepository: notificationSettingsRepository,
    requestRepository,
    acknowledgementRepository: utmValueAcknowledgementRepository,
    mailer,
    appBaseUrl: config.app.baseUrl,
    timezone: config.app.timezone,
    logger
  });
  const notificationScheduler = new ConsistencyNotificationScheduler(notificationService);
  const userAdminController = new UserAdminController({
    userAccountService,
    notificationSettingsRepository,
    smtpConfigured: mailer.isConfigured()
  });
  const campaignStandardsAdminController = new CampaignStandardsAdminController({
    standardsService: campaignStandardsService,
    rulesService,
    standalone: true
  });
  const accountController = new AccountController({ userAccountService });

  const totalUsers = await userRepository.countAll();
  if (totalUsers === 0 && !setupConsoleAuthService.enabled) {
    logger.warning?.("No user accounts exist and the setup console is disabled. Set SETUP_ADMIN_USERNAME and SETUP_ADMIN_PASSWORD in .env to create the first administrator.");
  }

  const router = new Router();
  router.add("GET", "/assets/just-flow-logo.png", () => NodeResponse.binary(
    fs.readFileSync(path.join(projectRoot, "Just-Flow-Horizontal-No-Drop-Color-FINAL.png")),
    200,
    { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" }
  ));
  router.add("GET", "/assets/jf-drop.png", () => NodeResponse.binary(
    fs.readFileSync(path.join(projectRoot, "JF_Drop_40x48px.png")),
    200,
    { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" }
  ));
  const wantsHtml = (request) => request.method === "GET"
    && !request.path.endsWith(".json")
    && !request.path.endsWith(".csv");
  const protect = (handler) => async (request) => {
    const user = await auth.loadUser(request);
    if (!user) {
      if (wantsHtml(request)) {
        return NodeResponse.redirect(`/login?${new URLSearchParams({ return_to: request.path }).toString()}`);
      }
      return NodeResponse.json({ status: "error", error: { code: "auth_required", message: "Sign in is required." } }, 401);
    }
    request.user = {
      id: Number(user.id),
      username: user.username,
      displayName: user.display_name,
      role: user.role
    };
    return handler(request);
  };
  const requireAdmin = (handler) => protect((request) => {
    if (request.user.role !== "admin") {
      if (wantsHtml(request)) {
        return NodeResponse.text("Forbidden: administrator access is required.", 403, { "Content-Type": "text/plain; charset=utf-8" });
      }
      return NodeResponse.json({ status: "error", error: { code: "forbidden", message: "Administrator access is required." } }, 403);
    }
    return handler(request);
  });
  const requireSetup = (handler) => async (request) => {
    if (!setupConsoleAuthService.isUnlocked(request)) {
      return NodeResponse.redirect("/setup");
    }
    return handler(request);
  };

  router.add("GET", "/", () => NodeResponse.redirect("/new"));
  router.add("GET", "/health", () => NodeResponse.json({ status: "ok", app: "utm-builder" }));
  router.add("GET", "/login", (request) => login.handleHtml(request));
  router.add("POST", "/login", (request) => login.handleLogin(request));
  router.add("POST", "/logout", (request) => login.handleLogout(request));
  router.add("GET", "/setup", (request) => setupConsoleController.handleHtml(request));
  router.add("POST", "/setup/login", (request) => setupConsoleController.handleLogin(request));
  router.add("POST", "/setup/logout", (request) => setupConsoleController.handleLogout(request));
  router.add("POST", "/setup/admins", requireSetup((request) => setupConsoleController.handleCreateAdmin(request)));
  router.add("POST", "/setup/admins/update", requireSetup((request) => setupConsoleController.handleUpdateAdmin(request)));
  router.add("POST", "/setup/admins/reset-password", requireSetup((request) => setupConsoleController.handleResetPassword(request)));
  router.add("POST", "/setup/admins/delete", requireSetup((request) => setupConsoleController.handleDeleteAdmin(request)));
  router.add("GET", "/users", requireAdmin((request) => userAdminController.handleHtml(request)));
  router.add("POST", "/users", requireAdmin((request) => userAdminController.handleCreate(request)));
  router.add("POST", "/users/update", requireAdmin((request) => userAdminController.handleUpdate(request)));
  router.add("POST", "/users/reset-password", requireAdmin((request) => userAdminController.handleResetPassword(request)));
  router.add("POST", "/users/delete", requireAdmin((request) => userAdminController.handleDelete(request)));
  router.add("POST", "/users/notification-settings", requireAdmin((request) => userAdminController.handleNotificationSettings(request)));
  router.add("GET", "/standards", requireAdmin((request) => campaignStandardsAdminController.handleHtml(request)));
  router.add("POST", "/standards", requireAdmin((request) => campaignStandardsAdminController.handleCreate(request)));
  router.add("POST", "/standards/settings", requireAdmin((request) => campaignStandardsAdminController.handleSettings(request)));
  router.add("POST", "/standards/update", requireAdmin((request) => campaignStandardsAdminController.handleUpdate(request)));
  router.add("POST", "/standards/duplicate", requireAdmin((request) => campaignStandardsAdminController.handleDuplicate(request)));
  router.add("POST", "/standards/toggle", requireAdmin((request) => campaignStandardsAdminController.handleToggle(request)));
  router.add("POST", "/standards/delete", requireAdmin((request) => campaignStandardsAdminController.handleDelete(request)));
  router.add("GET", "/account", protect((request) => accountController.handleHtml(request)));
  router.add("POST", "/account/password", protect((request) => accountController.handlePassword(request)));
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
  router.add("GET", "/utms/history.json", protect((request) => utmLibraryController.handleHistory(request)));
  router.add("POST", "/utms/supplement", protect((request) => utmLibraryController.handleSupplement(request)));
  router.add("POST", "/utms/governance/acknowledge", requireAdmin((request) => utmLibraryController.handleAcknowledge(request)));
  router.add("POST", "/utms/delete", requireAdmin((request) => utmLibraryController.handleDelete(request)));
  router.add("GET", "/imports", requireAdmin((request) => utmImportController.handleHtml(request)));
  router.add("POST", "/imports", requireAdmin((request) => utmImportController.handleImport(request)));

  return new Application(router, migrationRunner, config, {
    start: async () => notificationScheduler.start(),
    stop: async () => {
      notificationScheduler.stop();
      mailer.close();
      await database.close?.();
    }
  }, { logger, slowRequestMs: config.app.slowRequestMs });
}

function resolveConfig(projectRoot) {
  const databaseClient = String(process.env.DATABASE_CLIENT ?? baseConfig.database.client ?? "sqlite").toLowerCase() === "postgres" ? "postgres" : "sqlite";
  return {
    app: {
      name: "JF UTM Builder",
      baseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
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
    auth: {
      cookieSecret: process.env.TRACKING_SECRET_ENCRYPTION_KEY ?? "",
      sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? baseConfig.auth.sessionTtlSeconds)
    },
    setup: {
      username: process.env.SETUP_ADMIN_USERNAME ?? "",
      password: process.env.SETUP_ADMIN_PASSWORD ?? ""
    },
    smtp: {
      host: process.env.SMTP_HOST ?? "",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: parseBoolean(process.env.SMTP_SECURE, false),
      user: process.env.SMTP_USER ?? "",
      password: process.env.SMTP_PASSWORD ?? "",
      from: process.env.SMTP_FROM ?? ""
    }
  };
}

function parseBoolean(value, fallback) {
  if (value === undefined) return Boolean(fallback);
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
