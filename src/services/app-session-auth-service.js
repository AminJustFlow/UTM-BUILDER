import crypto from "node:crypto";

export class AppSessionAuthService {
  constructor({
    enabled = false,
    username = "",
    password = "",
    realm = "Just Flow Marketing Hub",
    sessionCookieName = "jf_app_session",
    sessionTtlSeconds = 60 * 60 * 12,
    cookieSecret = ""
  } = {}) {
    this.enabled = Boolean(enabled && username && password);
    this.username = String(username ?? "");
    this.password = String(password ?? "");
    this.realm = String(realm ?? "Just Flow Marketing Hub");
    this.sessionCookieName = String(sessionCookieName ?? "jf_app_session");
    this.sessionTtlSeconds = Math.max(300, Number(sessionTtlSeconds) || (60 * 60 * 12));
    this.cookieSecret = String(cookieSecret ?? "") || `${this.realm}:${this.username}:${this.password}`;
  }

  isAuthenticated(request) {
    if (!this.enabled) {
      return true;
    }

    const token = request?.cookie?.(this.sessionCookieName) ?? null;
    return Boolean(token && this.verifySessionToken(token));
  }

  authenticateCredentials(username, password) {
    if (!this.enabled) {
      return true;
    }

    return this.matches(username, this.username) && this.matches(password, this.password);
  }

  createSessionCookie({ secure = false } = {}) {
    const sameSite = "None";
    const effectiveSecure = secure || sameSite === "None";
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      sub: this.username,
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
      secure: effectiveSecure,
      maxAge: this.sessionTtlSeconds
    });
  }

  clearSessionCookie({ secure = false } = {}) {
    const sameSite = "None";
    const effectiveSecure = secure || sameSite === "None";
    return serializeCookie(this.sessionCookieName, "", {
      path: "/",
      httpOnly: true,
      sameSite,
      secure: effectiveSecure,
      maxAge: 0
    });
  }

  verifySessionToken(token) {
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
      return payload?.sub === this.username
        && Number(payload?.exp ?? 0) >= now;
    } catch {
      return false;
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

function serializeCookie(name, value, {
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
