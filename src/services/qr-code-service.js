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
  }

  isManagedUrl(value) {
    return /^\/qr-assets\/[^/]+\/(pdf|png)$/u.test(String(value ?? ""));
  }

  async generate(targetUrl, { fingerprint, client, campaign, createdAt = new Date() }) {
    if (!this.config.apiKey) throw new QrCodeError("QR Stuff is not configured.", { code: "QR_STUFF_NOT_CONFIGURED" });
    const safeFingerprint = String(fingerprint ?? "").replace(/[^a-zA-Z0-9_-]/gu, "");
    if (!safeFingerprint) throw new QrCodeError("A valid fingerprint is required.", { code: "QR_INVALID_FINGERPRINT" });

    const [pdf, png] = await Promise.all([
      this.requestFormat(targetUrl, "pdf"),
      this.requestFormat(targetUrl, "png")
    ]);
    const directory = path.join(this.config.storagePath, safeFingerprint);
    const temporary = `${directory}.tmp-${process.pid}-${Date.now()}`;
    await fs.mkdir(temporary, { recursive: true });
    try {
      await Promise.all([
        fs.writeFile(path.join(temporary, "qr.pdf"), pdf),
        fs.writeFile(path.join(temporary, "qr.png"), png),
        fs.writeFile(path.join(temporary, "metadata.json"), JSON.stringify({ filename: buildQrFilename(createdAt, client, campaign, this.config.timezone) }))
      ]);
      await fs.rm(directory, { recursive: true, force: true });
      await fs.rename(temporary, directory);
    } catch (error) {
      await fs.rm(temporary, { recursive: true, force: true });
      throw error;
    }
    return { qrUrl: `/qr-assets/${safeFingerprint}/pdf`, qrPreviewUrl: `/qr-assets/${safeFingerprint}/png` };
  }

  async requestFormat(targetUrl, format) {
    let response;
    try {
      response = await this.httpClient.request("POST", `${this.config.apiBase.replace(/\/$/u, "")}/generate`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        json: {
          data: { url: targetUrl }, type: "URL", dynamic: false, format,
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
    if (!safeFingerprint || !["pdf", "png"].includes(format)) return null;
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
