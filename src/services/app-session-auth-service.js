import crypto from "node:crypto";
import { verifyPassword } from "../support/password.js";

export class AppSessionAuthService {
  constructor({
    userRepository,
    sessionCookieName = "jf_app_session",
    sessionTtlSeconds = 60 * 60 * 12,
    cookieSecret = ""
  } = {}) {
    this.userRepository = userRepository;
    this.sessionCookieName = String(sessionCookieName ?? "jf_app_session");
    this.sessionTtlSeconds = Math.max(300, Number(sessionTtlSeconds) || (60 * 60 * 12));
    this.cookieSecret = String(cookieSecret ?? "");
    if (!this.cookieSecret) {
      throw new Error("TRACKING_SECRET_ENCRYPTION_KEY is required for signed sessions.");
    }
  }

  async authenticate(username, password) {
    const normalized = String(username ?? "").trim().toLowerCase();
    if (!normalized || !password) {
      return null;
    }

    const user = await this.userRepository.findByUsername(normalized);
    if (!user || Number(user.is_active) !== 1) {
      return null;
    }

    if (!verifyPassword(password, user.password_salt, user.password_hash)) {
      return null;
    }

    return user;
  }

  async loadUser(request) {
    const token = request?.cookie?.(this.sessionCookieName) ?? null;
    const payload = this.verifySessionToken(token);
    if (!payload) {
      return null;
    }

    const user = await this.userRepository.findById(Number(payload.sub));
    if (!user || Number(user.is_active) !== 1) {
      return null;
    }
    if (!payload.passwordVersion || !this.matches(payload.passwordVersion, passwordVersion(user.password_hash))) {
      return null;
    }

    return user;
  }

  createSessionCookie(user, { secure = false } = {}) {
    const sameSite = "Lax";
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      sub: String(user.id),
      name: user.display_name,
      role: user.role,
      passwordVersion: passwordVersion(user.password_hash),
      iat: now,
      exp: now + this.sessionTtlSeconds
    });
    const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
    const signature = this.sign(encodedPayload);
    const token = `${encodedPayload}.${signature}`;
    return serializeCookie(this.sessionCookieName, token, {
      path: "/",
      httpOnly: true,
      sameSite,
      secure,
      maxAge: this.sessionTtlSeconds
    });
  }

  clearSessionCookie({ secure = false } = {}) {
    const sameSite = "Lax";
    return serializeCookie(this.sessionCookieName, "", {
      path: "/",
      httpOnly: true,
      sameSite,
      secure,
      maxAge: 0
    });
  }

  verifySessionToken(token) {
    const text = String(token ?? "").trim();
    const separatorIndex = text.lastIndexOf(".");
    if (separatorIndex <= 0) {
      return null;
    }

    const encodedPayload = text.slice(0, separatorIndex);
    const signature = text.slice(separatorIndex + 1);
    if (!this.matches(signature, this.sign(encodedPayload))) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
      const now = Math.floor(Date.now() / 1000);
      if (!payload?.sub || Number(payload?.exp ?? 0) < now) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  sign(value) {
    return crypto.createHmac("sha256", this.cookieSecret)
      .update(String(value ?? ""), "utf8")
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

function passwordVersion(passwordHash) {
  return crypto.createHash("sha256").update(String(passwordHash ?? ""), "utf8").digest("base64url");
}

export function serializeCookie(name, value, {
  path = "/",
  httpOnly = true,
  sameSite = "Lax",
  secure = false,
  maxAge = null
} = {}) {
  const parts = [`${name}=${encodeURIComponent(String(value ?? ""))}`, `Path=${path}`];
  if (Number.isFinite(Number(maxAge))) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(Number(maxAge)))}`);
  }
  if (httpOnly) {
    parts.push("HttpOnly");
  }
  if (secure) {
    parts.push("Secure");
  }
  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  }

  return parts.join("; ");
}
