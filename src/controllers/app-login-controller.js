import { NodeResponse } from "../http/response.js";
import { renderAuthPage, parseFormBody, normalizeText, normalizeReturnTo, isSecureRequest, escapeHtml, escapeAttribute } from "./auth-page.js";

export class AppLoginController {
  constructor({ appSessionAuthService, defaultPath = "/new" }) {
    this.appSessionAuthService = appSessionAuthService;
    this.defaultPath = defaultPath;
  }

  async handleHtml(request) {
    const user = await this.appSessionAuthService.loadUser(request);
    if (user) {
      return NodeResponse.redirect(normalizeReturnTo(request.query.return_to) || this.defaultPath);
    }

    return NodeResponse.text(renderLoginHtml({
      returnTo: normalizeReturnTo(request.query.return_to),
      error: normalizeText(request.query.error)
    }), 200, {
      "Content-Type": "text/html; charset=utf-8"
    });
  }

  async handleLogin(request) {
    const form = parseFormBody(request.rawBody);
    const username = normalizeText(form.username);
    const password = normalizeText(form.password);
    const returnTo = normalizeReturnTo(form.return_to);

    const user = await this.appSessionAuthService.authenticate(username, password);
    if (!user) {
      return NodeResponse.text(renderLoginHtml({
        returnTo,
        error: "Invalid username or password."
      }), 401, {
        "Content-Type": "text/html; charset=utf-8"
      });
    }

    const secure = isSecureRequest(request);
    return NodeResponse.redirect(returnTo || this.defaultPath, 302, {
      "Set-Cookie": this.appSessionAuthService.createSessionCookie(user, { secure })
    });
  }

  async handleLogout(request) {
    const secure = isSecureRequest(request);
    return NodeResponse.redirect("/login", 302, {
      "Set-Cookie": this.appSessionAuthService.clearSessionCookie({ secure })
    });
  }
}

function renderLoginHtml({ returnTo = "", error = "" }) {
  return renderAuthPage({
    title: "Sign In",
    heading: "Sign In",
    lede: "Sign in to access the Just Flow UTM Builder.",
    error,
    body: `<form method="post" action="/login">
      <input type="hidden" name="return_to" value="${escapeAttribute(returnTo)}">
      <label>Username<input type="text" name="username" autocomplete="username" required></label>
      <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
      <button class="button" type="submit">Sign In</button>
    </form>
    <p class="auth-foot">Need to create administrator accounts? <a href="/setup">Open the setup console</a>.</p>`
  });
}
