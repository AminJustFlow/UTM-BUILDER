import { NodeResponse } from "../http/response.js";
import { parseFormBody, normalizeText, escapeHtml, escapeAttribute } from "./auth-page.js";
import { BRAND_HEAD_HTML, renderJustFlowShellStyles, renderJustFlowSidebar, renderJustFlowThemeScript, renderJustFlowTopbar } from "./app-shell.js";

export class ClientManagementController {
  constructor({ service }) { this.service = service; }
  async handleHtml(request) {
    const clients = await this.service.list();
    return NodeResponse.text(renderPage({ clients, user: request.user, toast: normalizeText(request.query.toast), level: normalizeText(request.query.toast_level) }), 200, { "Content-Type": "text/html; charset=utf-8" });
  }
  async handleRename(request) {
    const form = parseFormBody(request.rawBody);
    return redirect(await this.service.rename(form.client_key, form.display_name, request.user));
  }
  async handlePurge(request) {
    const form = parseFormBody(request.rawBody);
    return redirect(await this.service.purge(form.client_key, form.confirmation, request.user));
  }
}

function redirect(result) {
  return NodeResponse.redirect(`/clients?${new URLSearchParams({ toast: result.message, toast_level: result.ok ? "success" : "error" })}`);
}

function renderPage({ clients, user, toast, level }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BRAND_HEAD_HTML}<title>Clients</title><style>${renderJustFlowShellStyles()}
  .stack{display:grid;gap:16px}.client-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}.client-card{padding:18px}.client-key{font-family:monospace;color:var(--text-3)}.form{display:grid;gap:9px;margin-top:14px}.form input{height:36px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text)}.danger{border-color:var(--neg)}.danger .btn{background:var(--neg);border-color:var(--neg);color:#fff}.warning{color:var(--neg);font-size:12px}.toast{position:fixed;right:16px;bottom:16px;padding:12px 14px;border-radius:8px;background:var(--pos);color:#fff;opacity:0}.toast.error{background:var(--neg)}.toast.visible{opacity:1}</style></head><body>${renderJustFlowThemeScript()}<div class="app">${renderJustFlowSidebar("clients", { standaloneUtm: true, user })}<main class="main">${renderJustFlowTopbar({ section: "UTM Builder", title: "Clients", showSearch: false })}<div class="page"><div class="page-header"><div class="page-title-block"><h1>Clients</h1><p class="subtitle">Change visible names or permanently purge a client and all associated UTM data.</p></div></div><div class="client-grid">${clients.map(renderClient).join("")}</div></div></main></div><div id="toast" class="toast ${escapeAttribute(level)}">${escapeHtml(toast)}</div><script>const t=document.getElementById('toast');if(t.textContent.trim()){t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),4000)}function confirmPurge(form,key){const entered=prompt('This permanently deletes all data for '+key+'. Type PURGE '+key+' to continue:');if(entered===null)return false;form.elements.confirmation.value=entered;return true}</script></body></html>`;
}

function renderClient(client) {
  return `<section class="card client-card"><h3>${escapeHtml(client.displayName)}</h3><div class="client-key">Internal key: ${escapeHtml(client.key)}</div><form class="form" method="post" action="/clients/rename"><input type="hidden" name="client_key" value="${escapeAttribute(client.key)}"><label>Visible client name</label><input name="display_name" value="${escapeAttribute(client.displayName)}" maxlength="100" required><div class="meta">Renaming changes only the visible name. The internal key and existing UTM data stay unchanged.</div><button class="btn btn-primary" type="submit">Update visible name</button></form><form class="form danger" method="post" action="/clients/purge" onsubmit="return confirmPurge(this,'${escapeAttribute(client.key)}')"><input type="hidden" name="client_key" value="${escapeAttribute(client.key)}"><input type="hidden" name="confirmation"><div class="warning">Irreversible: removes UTMs, generated links, dictionary values, standards, history, and stored QR assets.</div><button class="btn" type="submit">Permanently purge client</button></form></section>`;
}
