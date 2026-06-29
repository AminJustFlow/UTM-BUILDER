import { NodeResponse } from "../http/response.js";
import { renderAuthPage, parseFormBody, normalizeText, isSecureRequest, escapeHtml, escapeAttribute } from "./auth-page.js";

export class SetupConsoleController {
  constructor({ setupConsoleAuthService, userAccountService }) {
    this.setupConsoleAuthService = setupConsoleAuthService;
    this.userAccountService = userAccountService;
  }

  async handleHtml(request) {
    if (!this.setupConsoleAuthService.enabled) {
      return NodeResponse.text(renderAuthPage({
        title: "Setup Console",
        heading: "Setup Console",
        lede: "Administrator setup is not configured yet.",
        notice: "Set SETUP_ADMIN_USERNAME and SETUP_ADMIN_PASSWORD in your .env file, then restart the app to create administrator accounts."
      }), 200, htmlHeaders());
    }

    const error = normalizeText(request.query.error);
    const notice = normalizeText(request.query.notice);

    if (!this.setupConsoleAuthService.isUnlocked(request)) {
      return NodeResponse.text(renderAuthPage({
        title: "Setup Console",
        heading: "Setup Console",
        lede: "Enter the setup credentials from your .env file to manage administrator accounts.",
        error,
        notice,
        body: `<form method="post" action="/setup/login">
          <label>Setup username<input type="text" name="username" autocomplete="off" required></label>
          <label>Setup password<input type="password" name="password" autocomplete="off" required></label>
          <button class="button" type="submit">Unlock setup console</button>
        </form>
        <p class="auth-foot"><a href="/login">Back to sign in</a></p>`
      }), this.setupConsoleAuthService.isUnlocked(request) ? 200 : 200, htmlHeaders());
    }

    const admins = await this.userAccountService.list("admin");
    return NodeResponse.text(renderAuthPage({
      title: "Setup Console",
      heading: "Administrator Accounts",
      lede: "Create and manage administrator accounts. Admins sign in normally and manage regular users from the in-app Users page.",
      error,
      notice,
      body: `${renderAdminTable(admins)}
      <fieldset>
        <legend>Create administrator</legend>
        <form method="post" action="/setup/admins">
          <label>Full name<input type="text" name="display_name" required></label>
          <label>Username<input type="text" name="username" autocomplete="off" required></label>
          <label>Temporary password<input type="password" name="password" autocomplete="new-password" required></label>
          <button class="button" type="submit">Create administrator</button>
        </form>
      </fieldset>
      <p class="auth-foot">
        <a href="/login">Go to sign in</a>
        &nbsp;·&nbsp;
        <form method="post" action="/setup/logout" style="display:inline"><button class="button secondary" type="submit" style="min-height:2.1rem;padding:.35rem .7rem;border-radius:.7rem">Lock setup console</button></form>
      </p>`
    }), 200, htmlHeaders());
  }

  async handleLogin(request) {
    const form = parseFormBody(request.rawBody);
    if (!this.setupConsoleAuthService.authenticateCredentials(form.username, form.password)) {
      return NodeResponse.redirect(`/setup?error=${encodeURIComponent("Invalid setup credentials.")}`);
    }
    const secure = isSecureRequest(request);
    return NodeResponse.redirect("/setup", 302, {
      "Set-Cookie": this.setupConsoleAuthService.createCookie({ secure })
    });
  }

  async handleLogout(request) {
    const secure = isSecureRequest(request);
    return NodeResponse.redirect("/setup", 302, {
      "Set-Cookie": this.setupConsoleAuthService.clearCookie({ secure })
    });
  }

  async handleCreateAdmin(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.createUser({
      username: form.username,
      displayName: form.display_name,
      password: form.password,
      role: "admin"
    });
    return redirectWithResult(result, `Administrator "${normalizeText(form.username).toLowerCase()}" created.`);
  }

  async handleUpdateAdmin(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.setActive(form.id, normalizeText(form.action) === "activate");
    return redirectWithResult(result, "Administrator updated.");
  }

  async handleResetPassword(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.resetPassword(form.id, form.password);
    return redirectWithResult(result, "Administrator password reset.");
  }

  async handleDeleteAdmin(request) {
    const form = parseFormBody(request.rawBody);
    const result = await this.userAccountService.deleteUser(form.id);
    return redirectWithResult(result, "Administrator removed.");
  }
}

function renderAdminTable(admins) {
  if (!admins.length) {
    return `<p class="lede">No administrator accounts exist yet. Create the first one below.</p>`;
  }
  return `<table>
    <thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>
      ${admins.map((admin) => `<tr>
        <td>${escapeHtml(admin.displayName)}</td>
        <td>${escapeHtml(admin.username)}</td>
        <td>${admin.isActive ? '<span class="pill on">Active</span>' : '<span class="pill off">Disabled</span>'}</td>
        <td>
          <div class="row-actions">
            <form method="post" action="/setup/admins/update">
              <input type="hidden" name="id" value="${escapeAttribute(admin.id)}">
              <input type="hidden" name="action" value="${admin.isActive ? "deactivate" : "activate"}">
              <button class="button secondary" type="submit">${admin.isActive ? "Disable" : "Enable"}</button>
            </form>
            <form method="post" action="/setup/admins/reset-password" onsubmit="return promptReset(this)">
              <input type="hidden" name="id" value="${escapeAttribute(admin.id)}">
              <input type="hidden" name="password" value="">
              <button class="button secondary" type="submit">Reset password</button>
            </form>
            <form method="post" action="/setup/admins/delete" onsubmit="return confirm('Remove this administrator?')">
              <input type="hidden" name="id" value="${escapeAttribute(admin.id)}">
              <button class="button danger" type="submit">Delete</button>
            </form>
          </div>
        </td>
      </tr>`).join("")}
    </tbody>
  </table>
  <script>function promptReset(formEl){var value=window.prompt("Enter a new password (min 8 characters):");if(!value){return false}formEl.elements.password.value=value;return true}</script>`;
}

function redirectWithResult(result, successMessage) {
  if (!result.ok) {
    return NodeResponse.redirect(`/setup?error=${encodeURIComponent(result.message)}`);
  }
  return NodeResponse.redirect(`/setup?notice=${encodeURIComponent(successMessage)}`);
}

function htmlHeaders() {
  return { "Content-Type": "text/html; charset=utf-8" };
}
