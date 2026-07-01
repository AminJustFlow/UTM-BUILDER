import { NodeResponse } from "../http/response.js";
import { parseFormBody, normalizeText, escapeHtml, escapeAttribute } from "./auth-page.js";
import {
  BRAND_HEAD_HTML,
  renderIcon,
  renderJustFlowShellStyles,
  renderJustFlowSidebar,
  renderJustFlowThemeScript,
  renderJustFlowTopbar,
  renderLoadingStyles
} from "./app-shell.js";

export class UserAdminController {
  constructor({ userAccountService, notificationSettingsRepository = null, smtpConfigured = false, standalone = true }) {
    this.userAccountService = userAccountService;
    this.notificationSettingsRepository = notificationSettingsRepository;
    this.smtpConfigured = smtpConfigured;
    this.standalone = standalone;
  }

  async handleHtml(request) {
    const users = await this.userAccountService.list();
    const notificationSettings = await this.notificationSettingsRepository?.get?.();
    return NodeResponse.text(renderPage({
      user: request.user,
      standalone: this.standalone,
      users,
      notificationSettings,
      smtpConfigured: this.smtpConfigured,
      toast: normalizeText(request.query.toast),
      toastLevel: normalizeText(request.query.toast_level) || "success"
    }), 200, htmlHeaders());
  }

  async handleNotificationSettings(request) {
    const form = parseFormBody(request.rawBody);
    const recipients = normalizeRecipients(form.recipients);
    const invalid = recipients.filter((email) => !EMAIL_PATTERN.test(email));
    if (invalid.length) return redirectWithMessage(`Invalid email address: ${invalid[0]}`, "error");
    const enabled = normalizeText(form.enabled) === "1";
    if (enabled && !recipients.length) return redirectWithMessage("Add at least one recipient before enabling notifications.", "error");
    if (enabled && !this.smtpConfigured) return redirectWithMessage("Configure SMTP in .env before enabling notifications.", "error");
    await this.notificationSettingsRepository.update({
      enabled, recipients, userId: request.user.id, userName: request.user.displayName
    });
    return redirectWithMessage("Notification settings updated.", "success");
  }

  async handleCreate(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.createUser({
      username: form.username,
      displayName: form.display_name,
      password: form.password,
      role: "user"
    });
    return redirectWithResult(result, `User "${normalizeText(form.username).toLowerCase()}" created.`);
  }

  async handleUpdate(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.setActive(form.id, normalizeText(form.action) === "activate");
    return redirectWithResult(result, "User updated.");
  }

  async handleResetPassword(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.resetPassword(form.id, form.password);
    return redirectWithResult(result, "Password reset.");
  }

  async handleDelete(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.deleteUser(form.id);
    return redirectWithResult(result, "User removed.");
  }
}

function renderPage(view) {
  const { user, users, toast, toastLevel, notificationSettings = {}, smtpConfigured } = view;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${BRAND_HEAD_HTML}
  <title>Users</title>
  <style>
    ${renderJustFlowShellStyles()}
    ${renderLoadingStyles()}
    .stack{display:flex;flex-direction:column;gap:16px}
    table.data{width:100%;border-collapse:collapse;font-size:13px}
    .data th,.data td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
    .data th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-2);background:var(--surface-2)}
    .row-actions{display:flex;gap:6px;flex-wrap:wrap}.row-actions form{display:inline;margin:0}
    .pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}.pill.on{background:var(--pos-soft);color:var(--pos)}.pill.off{background:var(--neg-soft);color:var(--neg)}
    .form-grid{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end}.form-grid .field{display:flex;flex-direction:column;gap:4px}.form-grid label{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em}.form-grid input{height:36px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text);font:inherit}
    .toast{position:fixed;right:16px;bottom:16px;max-width:22rem;padding:12px 14px;border-radius:var(--radius);background:var(--text);color:var(--surface);box-shadow:var(--shadow-lg);opacity:0;pointer-events:none;transform:translateY(12px);transition:opacity 140ms,transform 140ms;z-index:80}.toast.error{background:var(--neg);color:#fff}.toast.success{background:var(--pos);color:#fff}.toast.visible{opacity:1;transform:translateY(0)}
    @media(max-width:860px){.form-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${renderJustFlowThemeScript()}
  <div class="app">
    ${renderJustFlowSidebar("users", { standaloneUtm: view.standalone, user })}
    <main class="main">
      ${renderJustFlowTopbar({ section: "UTM Builder", title: "Users", showSearch: false })}
      <div class="page">
        <div class="stack">
          <div class="page-header">
            <div class="page-title-block">
              <h1>Users</h1>
              <p class="subtitle">View administrators and create or manage member accounts.</p>
            </div>
          </div>
          <section class="card">
            <div class="card-header"><div><h3>Add a user</h3><div class="meta">New members sign in with the username and password you set here.</div></div></div>
            <div class="card-body">
              <form method="post" action="/users" class="form-grid">
                <div class="field"><label>Full name</label><input type="text" name="display_name" required></div>
                <div class="field"><label>Username</label><input type="text" name="username" autocomplete="off" required></div>
                <div class="field"><label>Temporary password</label><input type="password" name="password" autocomplete="new-password" required></div>
                <div class="field"><button class="btn btn-primary" type="submit">${renderIcon("users")} Create user</button></div>
              </form>
            </div>
          </section>
          <section class="card">
            <div class="card-header"><div><h3>Consistency review emails</h3><div class="meta">Send one notification at 6:00 AM America/New_York when UTM values or combinations are waiting for review.</div></div></div>
            <div class="card-body">
              ${smtpConfigured ? "" : '<div class="toast error visible" style="position:static;margin-bottom:12px">SMTP is not configured. Add the SMTP variables to .env before enabling notifications.</div>'}
              <form method="post" action="/users/notification-settings" class="form-grid">
                <div class="field" style="grid-column:span 2"><label>Recipient emails</label><input type="text" name="recipients" value="${escapeAttribute((notificationSettings.recipients ?? []).join(", "))}" placeholder="person@example.com, manager@example.com"></div>
                <div class="field"><label>Delivery</label><select name="enabled"><option value="0"${notificationSettings.enabled ? "" : " selected"}>Off</option><option value="1"${notificationSettings.enabled ? " selected" : ""}>On — daily at 6:00 AM</option></select></div>
                <div class="field"><button class="btn btn-primary" type="submit">Save notification settings</button></div>
              </form>
              <div class="meta" style="margin-top:10px">Last run: ${escapeHtml(notificationSettings.lastRunLocalDate || "Never")} · Result: ${escapeHtml(notificationSettings.lastResult || "Not run")}${notificationSettings.lastError ? ` · Error: ${escapeHtml(notificationSettings.lastError)}` : ""}</div>
            </div>
          </section>
          <section class="card">
            <div class="card-header"><div><h3>All users</h3><div class="meta">${users.length} account${users.length === 1 ? "" : "s"}</div></div></div>
            <div class="card-body">
              ${users.length ? `<table class="data">
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>${users.map(renderUserRow).join("")}</tbody>
              </table>` : `<div class="meta">No user accounts yet.</div>`}
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
  <div class="toast ${escapeAttribute(toastLevel)}" id="toast">${escapeHtml(toast)}</div>
  <script>
    (function(){
      var toast=document.getElementById("toast");
      if(toast&&toast.textContent.trim()){toast.classList.add("visible");setTimeout(function(){toast.classList.remove("visible")},2800)}
    })();
    function promptReset(formEl){var value=window.prompt("Enter a new password (min 8 characters):");if(!value){return false}formEl.elements.password.value=value;return true}
  </script>
</body>
</html>`;
}

function renderUserRow(account) {
  return `<tr>
    <td>${escapeHtml(account.displayName)}</td>
    <td>${escapeHtml(account.username)}</td>
    <td>${escapeHtml(account.role === "admin" ? "Administrator" : "Member")}</td>
    <td>${account.isActive ? '<span class="pill on">Active</span>' : '<span class="pill off">Disabled</span>'}</td>
    <td>${escapeHtml(formatDate(account.createdAt))}</td>
    <td>
      <div class="row-actions">
        <form method="post" action="/users/update">
          <input type="hidden" name="id" value="${escapeAttribute(account.id)}">
          <input type="hidden" name="action" value="${account.isActive ? "deactivate" : "activate"}">
          <button class="btn" type="submit">${account.isActive ? "Disable" : "Enable"}</button>
        </form>
        <form method="post" action="/users/reset-password" onsubmit="return promptReset(this)">
          <input type="hidden" name="id" value="${escapeAttribute(account.id)}">
          <input type="hidden" name="password" value="">
          <button class="btn" type="submit">Reset password</button>
        </form>
        <form method="post" action="/users/delete" onsubmit="return confirm('Remove this user?')">
          <input type="hidden" name="id" value="${escapeAttribute(account.id)}">
          <button class="btn" type="submit">Delete</button>
        </form>
      </div>
    </td>
  </tr>`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  try {
    return new Date(value).toLocaleString("en-US", { dateStyle: "medium" });
  } catch {
    return String(value);
  }
}

function redirectWithResult(result, successMessage) {
  if (!result.ok) {
    return NodeResponse.redirect(`/users?${new URLSearchParams({ toast: result.message, toast_level: "error" }).toString()}`);
  }
  return NodeResponse.redirect(`/users?${new URLSearchParams({ toast: successMessage, toast_level: "success" }).toString()}`);
}

function redirectWithMessage(message, level) {
  return NodeResponse.redirect(`/users?${new URLSearchParams({ toast: message, toast_level: level }).toString()}`);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
function normalizeRecipients(value) {
  return [...new Set(String(value ?? "").split(/[\s,;]+/u).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

function htmlHeaders() {
  return { "Content-Type": "text/html; charset=utf-8" };
}
