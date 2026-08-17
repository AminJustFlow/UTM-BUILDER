import fs from "node:fs/promises";
import path from "node:path";

export class QrCodeError extends Error {
  constructor(message, { code = "QR_GENERATION_FAILED", statusCode = null, cause = null } = {}) {
    super(message);
    this.name = "QrCodeError";
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

export class QrCodeService {
  constructor(httpClient, config) {
    this.httpClient = httpClient;
    this.config = config;
    this.projectsCache = null;
    this.projectsCacheExpiresAt = 0;
  }

  isManagedUrl(value) {
    return /^\/qr-assets\/[^/]+\/pdf$/u.test(String(value ?? ""));
  }

  async listProjects({ force = false } = {}) {
    if (!this.config.apiKey) throw new QrCodeError("QR Stuff is not configured.", { code: "QR_STUFF_NOT_CONFIGURED" });
    if (!force && this.projectsCache && Date.now() < this.projectsCacheExpiresAt) return this.projectsCache;
    const projects = [];
    let page = 1;
    let lastPage = 1;
    do {
      let response;
      try {
        const url = new URL(`${this.config.apiBase.replace(/\/$/u, "")}/projects`);
        url.searchParams.set("page", String(page));
        response = await this.httpClient.request("GET", url.toString(), {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
          timeoutMs: this.config.timeoutMs,
          retries: 1
        });
      } catch (error) {
        throw new QrCodeError("QR Stuff projects could not be loaded.", { code: error?.name === "AbortError" ? "QR_STUFF_TIMEOUT" : "QR_STUFF_NETWORK_ERROR", cause: error });
      }
      if (response.statusCode >= 400) throw new QrCodeError("QR Stuff rejected the projects request.", { code: response.statusCode === 401 ? "QR_STUFF_AUTH_FAILED" : "QR_STUFF_PROJECTS_FAILED", statusCode: response.statusCode });
      const body = response.json();
      if (!Array.isArray(body.data)) throw new QrCodeError("QR Stuff returned an invalid projects response.", { code: "QR_STUFF_INVALID_RESPONSE" });
      for (const item of body.data) {
        const id = Number(item?.id);
        const name = String(item?.name ?? "").trim();
        if (Number.isInteger(id) && id > 0 && name) projects.push({ id, name });
      }
      lastPage = Math.max(page, Number(body.meta?.last_page) || page);
      page += 1;
    } while (page <= lastPage);
    const normalized = [...new Map(projects.map((project) => [project.id, project])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
    this.projectsCache = normalized;
    this.projectsCacheExpiresAt = Date.now() + Number(this.config.projectsCacheMs ?? 300000);
    return normalized;
  }

  async validateProject(projectId) {
    const id = Number(projectId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return (await this.listProjects()).find((project) => project.id === id) ?? null;
  }

  async generate(targetUrl, { fingerprint, client, campaign, projectId, projectName = null, createdAt = new Date() }) {
    if (!this.config.apiKey) throw new QrCodeError("QR Stuff is not configured.", { code: "QR_STUFF_NOT_CONFIGURED" });
    const safeFingerprint = String(fingerprint ?? "").replace(/[^a-zA-Z0-9_-]/gu, "");
    if (!safeFingerprint) throw new QrCodeError("A valid fingerprint is required.", { code: "QR_INVALID_FINGERPRINT" });

    const filename = buildQrFilename(createdAt, client, campaign, this.config.timezone);
    const pdf = await this.requestPdf(targetUrl, filename, projectId);
    const directory = path.join(this.config.storagePath, safeFingerprint);
    const temporary = `${directory}.tmp-${process.pid}-${Date.now()}`;
    await fs.mkdir(temporary, { recursive: true });
    try {
      await Promise.all([
        fs.writeFile(path.join(temporary, "qr.pdf"), pdf),
        fs.writeFile(path.join(temporary, "metadata.json"), JSON.stringify({ filename, qr_project_id: Number(projectId), qr_project_name: projectName }))
      ]);
      await fs.rm(directory, { recursive: true, force: true });
      await fs.rename(temporary, directory);
    } catch (error) {
      await fs.rm(temporary, { recursive: true, force: true });
      throw error;
    }
    return { qrUrl: `/qr-assets/${safeFingerprint}/pdf`, qrPreviewUrl: null };
  }

  async requestPdf(targetUrl, name, projectId) {
    let response;
    try {
      response = await this.httpClient.request("POST", `${this.config.apiBase.replace(/\/$/u, "")}/generate`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        json: {
          idproject: Number(projectId), name, data: { url: targetUrl }, type: "URL", dynamic: true, format: "pdf",
          size: this.config.size, resolution: this.config.resolution,
          error_correction_level: this.config.errorCorrectionLevel,
          colors: { bg: "#FFFFFF", fg: "#000000", finder: "#000000", finder_eye: "#000000", alignment_inner: "#000000", alignment_outer: "#000000", center_text: "#000000", transparent: true }
        },
        timeoutMs: this.config.timeoutMs, retries: 1, responseType: "buffer"
      });
    } catch (error) {
      throw new QrCodeError("QR Stuff could not be reached.", { code: error?.name === "AbortError" ? "QR_STUFF_TIMEOUT" : "QR_STUFF_NETWORK_ERROR", cause: error });
    }
    if (response.statusCode >= 400) throw new QrCodeError("QR Stuff rejected the generation request.", { code: response.statusCode === 401 ? "QR_STUFF_AUTH_FAILED" : "QR_STUFF_REQUEST_FAILED", statusCode: response.statusCode });
    if (!Buffer.isBuffer(response.body) || response.body.length === 0) throw new QrCodeError("QR Stuff returned an empty asset.", { code: "QR_STUFF_INVALID_RESPONSE" });
    return response.body;
  }

  async readAsset(fingerprint, format) {
    const safeFingerprint = String(fingerprint ?? "").replace(/[^a-zA-Z0-9_-]/gu, "");
    if (!safeFingerprint || format !== "pdf") return null;
    try {
      const [body, metadata] = await Promise.all([
        fs.readFile(path.join(this.config.storagePath, safeFingerprint, `qr.${format}`)),
        fs.readFile(path.join(this.config.storagePath, safeFingerprint, "metadata.json"), "utf8").then(JSON.parse)
      ]);
      return { body, filename: `${metadata.filename}.${format}` };
    } catch { return null; }
  }
}

export function buildQrFilename(value, client, campaign, timezone = "America/New_York") {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "2-digit", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const yymmdd = date.replace(/-/gu, "");
  const clientCode = sanitize(client, "CLIENT").toUpperCase();
  return `${yymmdd}-${clientCode}-${sanitize(campaign, "Campaign")}`;
}

function sanitize(value, fallback) {
  const cleaned = String(value ?? "").normalize("NFKD").replace(/[^a-zA-Z0-9]+/gu, "");
  return cleaned || fallback;
}
