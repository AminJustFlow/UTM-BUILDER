import crypto from "node:crypto";
import { serializeCookie } from "./app-session-auth-service.js";

export class SetupConsoleAuthService {
  constructor({
    username = "",
    password = "",
    cookieSecret = "",
    cookieName = "jf_setup_session",
    ttlSeconds = 60 * 60
  } = {}) {
    this.username = String(username ?? "");
    this.password = String(password ?? "");
    this.enabled = Boolean(this.username && this.password);
    this.cookieName = String(cookieName ?? "jf_setup_session");
    this.ttlSeconds = Math.max(300, Number(ttlSeconds) || (60 * 60));
    this.cookieSecret = String(cookieSecret ?? "") || "jf-utm-builder-insecure-default-secret";
  }

  authenticateCredentials(username, password) {
    if (!this.enabled) {
      return false;
    }
    return this.matches(String(username ?? "").trim(), this.username)
      && this.matches(String(password ?? ""), this.password);
  }

  isUnlocked(request) {
    if (!this.enabled) {
      return false;
    }
    const token = request?.cookie?.(this.cookieName) ?? null;
    return Boolean(token && this.verifyToken(token));
  }

  createCookie({ secure = false } = {}) {
    const sameSite = "None";
    const effectiveSecure = secure || sameSite === "None";
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ setup: true, iat: now, exp: now + this.ttlSeconds });
    const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
    const token = `${encodedPayload}.${this.sign(encodedPayload)}`;
    return serializeCookie(this.cookieName, token, {
      path: "/",
      httpOnly: true,
      sameSite,
      secure: effectiveSecure,
      maxAge: this.ttlSeconds
    });
  }

  clearCookie({ secure = false } = {}) {
    const sameSite = "None";
    const effectiveSecure = secure || sameSite === "None";
    return serializeCookie(this.cookieName, "", {
      path: "/",
      httpOnly: true,
      sameSite,
      secure: effectiveSecure,
      maxAge: 0
    });
  }

  verifyToken(token) {
    const text = String(token ?? "").trim();
    const separatorIndex = text.lastIndexOf(".");
    if (separatorIndex <= 0) {
      return false;
    }
    const encodedPayload = text.slice(0, separatorIndex);
    const signature = text.slice(separatorIndex + 1);
    if (!this.matches(signature, this.sign(encodedPayload))) {
      return false;
    }
    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
      const now = Math.floor(Date.now() / 1000);
      return payload?.setup === true && Number(payload?.exp ?? 0) >= now;
    } catch {
      return false;
    }
  }

  sign(value) {
    return crypto.createHmac("sha256", this.cookieSecret)
      .update(`setup:${String(value ?? "")}`, "utf8")
      .digest("base64url");
  }

  matches(left, right) {
    const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
    const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }
}
