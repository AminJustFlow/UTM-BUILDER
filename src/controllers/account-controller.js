import { NodeResponse } from "../http/response.js";
import { parseFormBody, normalizeText, escapeHtml, escapeAttribute } from "./auth-page.js";
import {
  renderJustFlowShellStyles,
  renderJustFlowSidebar,
  renderJustFlowThemeScript,
  renderJustFlowTopbar
} from "./app-shell.js";

export class AccountController {
  constructor({ userAccountService, standalone = true }) {
    this.userAccountService = userAccountService;
    this.standalone = standalone;
  }

  async handleHtml(request) {
    return NodeResponse.text(renderPage({
      user: request.user,
      standalone: this.standalone,
      toast: normalizeText(request.query.toast),
      toastLevel: normalizeText(request.query.toast_level) || "success"
    }), 200, htmlHeaders());
  }

  async handlePassword(request) {
    const form = parseFormBody(request.rawBody);
    const newPassword = normalizeText(form.new_password);
    const confirm = normalizeText(form.confirm_password);
    if (newPassword !== confirm) {
      return NodeResponse.redirect(toastUrl("New password and confirmation do not match.", "error"));
    }
    const result = await this.userAccountService.changeOwnPassword(
      request.user.id,
      normalizeText(form.current_password),
      newPassword
    );
    if (!result.ok) {
      return NodeResponse.redirect(toastUrl(result.message, "error"));
    }
    return NodeResponse.redirect(toastUrl("Password updated.", "success"));
  }
}

function renderPage(view) {
  const { user, toast, toastLevel } = view;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Account</title>
  <style>
    ${renderJustFlowShellStyles()}
    .stack{display:flex;flex-direction:column;gap:16px;max-width:560px}
    .field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}.field label{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em}.field input{height:36px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text);font:inherit}
    .kv{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13px}.kv dt{color:var(--text-3)}.kv dd{margin:0;font-weight:600}
    .toast{position:fixed;right:16px;bottom:16px;max-width:22rem;padding:12px 14px;border-radius:var(--radius);background:var(--text);color:var(--surface);box-shadow:var(--shadow-lg);opacity:0;pointer-events:none;transform:translateY(12px);transition:opacity 140ms,transform 140ms;z-index:80}.toast.error{background:var(--neg);color:#fff}.toast.success{background:var(--pos);color:#fff}.toast.visible{opacity:1;transform:translateY(0)}
  </style>
</head>
<body>
  ${renderJustFlowThemeScript()}
  <div class="app">
    ${renderJustFlowSidebar("account", { standaloneUtm: view.standalone, user })}
    <main class="main">
      ${renderJustFlowTopbar({ section: "UTM Builder", title: "My Account", showSearch: false })}
      <div class="page">
        <div class="stack">
          <div class="page-header"><div class="page-title-block"><h1>My Account</h1><p class="subtitle">Review your account and change your password.</p></div></div>
          <section class="card">
            <div class="card-header"><div><h3>Account</h3></div></div>
            <div class="card-body">
              <dl class="kv">
                <dt>Name</dt><dd>${escapeHtml(user.displayName)}</dd>
                <dt>Username</dt><dd>${escapeHtml(user.username)}</dd>
                <dt>Role</dt><dd>${escapeHtml(user.role === "admin" ? "Administrator" : "Member")}</dd>
              </dl>
            </div>
          </section>
          <section class="card">
            <div class="card-header"><div><h3>Change password</h3><div class="meta">Choose a password with at least 8 characters.</div></div></div>
            <div class="card-body">
              <form method="post" action="/account/password">
                <div class="field"><label>Current password</label><input type="password" name="current_password" autocomplete="current-password" required></div>
                <div class="field"><label>New password</label><input type="password" name="new_password" autocomplete="new-password" required></div>
                <div class="field"><label>Confirm new password</label><input type="password" name="confirm_password" autocomplete="new-password" required></div>
                <button class="btn btn-primary" type="submit">Update password</button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
  <div class="toast ${escapeAttribute(toastLevel)}" id="toast">${escapeHtml(toast)}</div>
  <script>(function(){var t=document.getElementById("toast");if(t&&t.textContent.trim()){t.classList.add("visible");setTimeout(function(){t.classList.remove("visible")},2800)}})();</script>
</body>
</html>`;
}

function toastUrl(message, level) {
  return `/account?${new URLSearchParams({ toast: message, toast_level: level }).toString()}`;
}

function htmlHeaders() {
  return { "Content-Type": "text/html; charset=utf-8" };
}
