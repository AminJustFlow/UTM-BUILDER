import { NodeResponse } from "../http/response.js";

export class AppLoginController {
  constructor({ appSessionAuthService, defaultPath = "/admin" }) {
    this.appSessionAuthService = appSessionAuthService;
    this.defaultPath = defaultPath;
  }

  async handleHtml(request) {
    if (!this.appSessionAuthService.enabled) {
      return NodeResponse.redirect(this.defaultPath);
    }

    if (this.appSessionAuthService.isAuthenticated(request)) {
      return NodeResponse.redirect(normalizeReturnTo(request.query.return_to) || this.defaultPath);
    }

    return NodeResponse.text(renderHtml({
      returnTo: normalizeReturnTo(request.query.return_to),
      error: normalizeText(request.query.error)
    }), 200, {
      "Content-Type": "text/html; charset=utf-8"
    });
  }

  async handleLogin(request) {
    if (!this.appSessionAuthService.enabled) {
      return NodeResponse.redirect(this.defaultPath);
    }

    const form = parseFormBody(request.rawBody);
    const username = normalizeText(form.username);
    const password = normalizeText(form.password);
    const returnTo = normalizeReturnTo(form.return_to);

    if (!this.appSessionAuthService.authenticateCredentials(username, password)) {
      return NodeResponse.text(renderHtml({
        returnTo,
        error: "Invalid username or password."
      }), 401, {
        "Content-Type": "text/html; charset=utf-8"
      });
    }

    const secure = isSecureRequest(request);
    return NodeResponse.redirect(returnTo || this.defaultPath, 302, {
      "Set-Cookie": this.appSessionAuthService.createSessionCookie({ secure })
    });
  }

  async handleLogout(request) {
    const secure = isSecureRequest(request);
    return NodeResponse.redirect("/login", 302, {
      "Set-Cookie": this.appSessionAuthService.clearSessionCookie({ secure })
    });
  }
}

function parseFormBody(rawBody) {
  const params = new URLSearchParams(String(rawBody ?? ""));
  return Object.fromEntries(params.entries());
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeReturnTo(value) {
  const text = normalizeText(value);
  if (!text.startsWith("/") || text.startsWith("//")) {
    return "";
  }
  return text;
}

function isSecureRequest(request) {
  const forwardedProto = normalizeText(request?.header?.("x-forwarded-proto"));
  if (forwardedProto.toLowerCase() === "https") {
    return true;
  }

  const origin = normalizeText(request?.header?.("origin"));
  if (origin.toLowerCase().startsWith("https://")) {
    return true;
  }

  const referer = normalizeText(request?.header?.("referer"));
  if (referer.toLowerCase().startsWith("https://")) {
    return true;
  }

  return false;
}

function renderHtml({ returnTo = "", error = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In</title>
  <style>
    :root{--bg:#f4efe5;--panel:rgba(255,250,242,.96);--ink:#17302a;--muted:#66766f;--accent:#018CC6;--line:rgba(23,48,42,.1);--danger:#b4432b;--shadow:0 24px 60px rgba(20,32,31,.09)}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;color:var(--ink);font-family:"Aptos","Segoe UI",sans-serif;background:radial-gradient(circle at top left,rgba(1,140,198,.18),transparent 32rem),radial-gradient(circle at top right,rgba(183,142,65,.12),transparent 26rem),linear-gradient(180deg,#faf7f1 0%,var(--bg) 100%)}
    .card{width:min(100%,28rem);padding:1.3rem;background:var(--panel);border:1px solid var(--line);border-radius:1.35rem;box-shadow:var(--shadow)}
    h1,p{margin:0}h1{font-family:"Aptos Display","Trebuchet MS",sans-serif;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.05em}.lede{margin-top:.45rem;color:var(--muted);line-height:1.5}
    form{display:grid;gap:.85rem;margin-top:1.2rem}label{display:grid;gap:.35rem;color:var(--muted);font-size:.92rem}
    input{width:100%;padding:.82rem .9rem;border:1px solid rgba(23,48,42,.14);border-radius:.95rem;background:rgba(255,255,255,.9);font:inherit;color:var(--ink)}
    input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(1,140,198,.14);background:#fff}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:2.9rem;padding:.82rem 1rem;border-radius:999px;border:0;background:var(--accent);color:#fff;font:inherit;cursor:pointer}
    .error{margin-top:1rem;padding:.75rem .85rem;border-radius:.95rem;background:rgba(180,67,43,.1);color:var(--danger)}
  </style>
</head>
<body>
  <main class="card">
    <h1>Sign In</h1>
    <p class="lede">Sign in to access the Just Flow app.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <form method="post" action="/login">
      <input type="hidden" name="return_to" value="${escapeAttribute(returnTo)}">
      <label>Username<input type="text" name="username" autocomplete="username" required></label>
      <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
      <button class="button" type="submit">Sign In</button>
    </form>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
