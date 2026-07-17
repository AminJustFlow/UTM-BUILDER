import { NodeResponse } from "../http/response.js";
import { parseFormBody, normalizeText, escapeHtml, escapeAttribute } from "./auth-page.js";
import {
  BRAND_HEAD_HTML,
  renderIcon,
  renderJustFlowShellStyles,
  renderJustFlowSidebar,
  renderJustFlowThemeScript,
  renderJustFlowTopbar
} from "./app-shell.js";

export class CampaignStandardsAdminController {
  constructor({ standardsService, rulesService, standalone = true }) {
    this.standardsService = standardsService;
    this.rulesService = rulesService;
    this.standalone = standalone;
  }

  async handleHtml(request) {
    const clientKey = this.standardsService.resolveClient(request.query.client);
    const standards = await this.standardsService.getAdminView(clientKey);
    standards.profiles = standards.profiles.map((profile) => ({
      ...profile,
      taxonomyWarnings: this.standardsService.taxonomyWarnings(clientKey, profile)
    }));
    const clients = this.rulesService.clients()
      .map((key) => ({ key, displayName: this.rulesService.getClientDisplayName(key) }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    return NodeResponse.text(renderPage({
      user: request.user,
      standalone: this.standalone,
      clients,
      standards,
      toast: normalizeText(request.query.toast),
      toastLevel: normalizeText(request.query.toast_level) || "success"
    }), 200, { "Content-Type": "text/html; charset=utf-8" });
  }

  async handleSettings(request) {
    return this.handleMutation(request, (form) => this.standardsService.updateSettings(form, request.user));
  }

  async handleCreate(request) {
    return this.handleMutation(request, (form) => this.standardsService.createProfile(withActive(form), request.user));
  }

  async handleUpdate(request) {
    return this.handleMutation(request, (form) => this.standardsService.updateProfile(withActive(form), request.user));
  }

  async handleDuplicate(request) {
    return this.handleMutation(request, (form) => this.standardsService.duplicateProfile(form, request.user));
  }

  async handleToggle(request) {
    return this.handleMutation(request, (form) => this.standardsService.toggleProfile(form, request.user));
  }

  async handleDelete(request) {
    return this.handleMutation(request, (form) => this.standardsService.deleteProfile(form, request.user));
  }

  async handleMutation(request, operation) {
    const form = parseFormBody(request.rawBody);
    const result = await operation(form);
    const client = result.clientKey || normalizeText(form.client_key);
    return redirect(client, result.message, result.ok ? "success" : "error");
  }
}

function renderPage(view) {
  const { standards } = view;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${BRAND_HEAD_HTML}
  <title>Campaign Standards</title>
  <style>
    ${renderJustFlowShellStyles()}
    .stack{display:flex;flex-direction:column;gap:16px}.selector{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.selector .field{min-width:240px}
    .standards-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.standard{padding:14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2);display:grid;gap:10px}.standard.inactive{opacity:.65}.standard-head,.row-actions{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}.standard h3{font-size:15px;margin:0}.standard-copy{font-size:13px;color:var(--text-2);line-height:1.5}.standard-details{display:grid;gap:5px;font-size:12px;color:var(--text-2)}.standard-details strong{color:var(--text)}.row-actions{justify-content:flex-start}.row-actions form{margin:0}
    .form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.form-grid .span-2{grid-column:span 2}.form-grid .full{grid-column:1/-1}.field textarea{min-height:82px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);font:inherit;resize:vertical}.field input,.field select{background:var(--surface)}.check{display:flex;gap:8px;align-items:center;font-size:13px}.check input{width:auto}.edit-panel{border-top:1px solid var(--border);padding-top:10px}.edit-panel summary{cursor:pointer;font-weight:600;font-size:12.5px;color:var(--accent)}.edit-panel[open] summary{margin-bottom:10px}.warning{padding:8px 10px;border-radius:var(--radius-sm);background:var(--warn-soft);color:var(--warn);font-size:12px}.audit{display:grid;gap:7px}.audit-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;font-size:12.5px;padding-bottom:7px;border-bottom:1px solid var(--border)}.audit-row:last-child{border:0}.audit-row .when{color:var(--text-3);white-space:nowrap}
    .toast{position:fixed;right:16px;bottom:16px;max-width:24rem;padding:12px 14px;border-radius:var(--radius);background:var(--text);color:var(--surface);box-shadow:var(--shadow-lg);opacity:0;pointer-events:none;transform:translateY(12px);transition:.15s;z-index:80}.toast.error{background:var(--neg);color:#fff}.toast.success{background:var(--pos);color:#fff}.toast.visible{opacity:1;transform:none}
    @media(max-width:1000px){.standards-grid{grid-template-columns:1fr}.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.form-grid{grid-template-columns:1fr}.form-grid .span-2{grid-column:auto}}
  </style>
</head>
<body>
  ${renderJustFlowThemeScript()}
  <div class="app">
    ${renderJustFlowSidebar("standards", { standaloneUtm: view.standalone, user: view.user })}
    <main class="main">
      ${renderJustFlowTopbar({ section: "UTM Builder", title: "Campaign Standards", showSearch: false })}
      <div class="page"><div class="stack">
        <div class="page-header">
          <div class="page-title-block"><h1>Campaign Standards</h1><p class="subtitle">Manage the advisory campaign guidance shown to users in the UTM builder.</p></div>
          <div class="page-actions"><a class="btn" href="/new">${renderIcon("link")} Open builder</a></div>
        </div>
        <section class="card"><div class="card-header"><div><h3>Choose client</h3><div class="meta">Changes appear the next time the builder page is loaded.</div></div></div><div class="card-body">
          <form method="get" action="/standards" class="selector"><div class="field"><label>Client</label><select name="client">${view.clients.map((client) => `<option value="${escapeAttribute(client.key)}"${client.key === standards.clientKey ? " selected" : ""}>${escapeHtml(client.displayName)}</option>`).join("")}</select></div><button class="btn btn-primary" type="submit">Manage standards</button></form>
        </div></section>
        <section class="card"><div class="card-header"><div><h3>${escapeHtml(standards.clientDisplayName)} guidance</h3><div class="meta">This summary appears before the campaign-specific rules.</div></div></div><div class="card-body">
          <form method="post" action="/standards/settings" class="form-grid"><input type="hidden" name="client_key" value="${escapeAttribute(standards.clientKey)}"><div class="field full"><label>Client guidance summary</label><textarea name="summary">${escapeHtml(standards.summary)}</textarea></div><div class="field"><button class="btn btn-primary" type="submit">Save summary</button></div></form>
        </div></section>
        <section class="card"><div class="card-header"><div><h3>Add campaign standard</h3><div class="meta">Source, medium, term, and content rules are advisory.</div></div></div><div class="card-body">${renderProfileForm({ clientKey: standards.clientKey, isActive: true }, "/standards", "Add standard")}</div></section>
        <section class="card"><div class="card-header"><div><h3>Standards</h3><div class="meta">${standards.profiles.length} standard${standards.profiles.length === 1 ? "" : "s"} for ${escapeHtml(standards.clientDisplayName)}</div></div></div><div class="card-body">
          ${standards.profiles.length ? `<div class="standards-grid">${standards.profiles.map(renderProfile).join("")}</div>` : '<div class="meta">No campaign standards yet. Add the first one above.</div>'}
        </div></section>
        <section class="card"><div class="card-header"><div><h3>Change history</h3><div class="meta">The latest administrator changes for this client.</div></div></div><div class="card-body">
          ${standards.audit.length ? `<div class="audit">${standards.audit.map((event) => `<div class="audit-row"><strong>${escapeHtml(humanize(event.action))}</strong><span>${escapeHtml(event.summary)} · ${escapeHtml(event.actorName)}</span><span class="when">${escapeHtml(formatDate(event.createdAt))}</span></div>`).join("")}</div>` : '<div class="meta">No administrator changes recorded yet.</div>'}
        </div></section>
      </div></div>
    </main>
  </div>
  <div class="toast ${escapeAttribute(view.toastLevel)}" id="toast">${escapeHtml(view.toast)}</div>
  <script>(function(){var toast=document.getElementById("toast");if(toast&&toast.textContent.trim()){toast.classList.add("visible");setTimeout(function(){toast.classList.remove("visible")},3000)}})()</script>
</body>
</html>`;
}

function renderProfile(profile) {
  const term = profile.fields?.term ?? {};
  const content = profile.fields?.content ?? {};
  return `<article class="standard${profile.isActive ? "" : " inactive"}">
    <div class="standard-head"><div><h3>${escapeHtml(profile.displayName || profile.campaign)}</h3><div class="meta">${escapeHtml(profile.campaign)}</div></div><div><span class="site-pill">Priority ${profile.priority}</span> ${profile.isActive ? '<span class="site-pill">Active</span>' : '<span class="site-pill">Inactive</span>'}</div></div>
    <div class="standard-copy">${escapeHtml(profile.guideline)}</div>
    <div class="standard-details">
      ${profile.source ? `<span><strong>Source:</strong> ${escapeHtml(profile.source)}</span>` : ""}
      ${profile.medium ? `<span><strong>Medium:</strong> ${escapeHtml(profile.medium)}</span>` : ""}
      ${term.help ? `<span><strong>Term:</strong> ${escapeHtml(term.help)}</span>` : ""}
      ${content.help ? `<span><strong>Content:</strong> ${escapeHtml(content.help)}</span>` : ""}
    </div>
    ${(profile.taxonomyWarnings ?? []).map((warning) => `<div class="warning">${escapeHtml(warning)}</div>`).join("")}
    <div class="row-actions">
      <form method="post" action="/standards/duplicate"><input type="hidden" name="id" value="${profile.id}"><input type="hidden" name="client_key" value="${escapeAttribute(profile.clientKey)}"><button class="btn" type="submit">Duplicate</button></form>
      <form method="post" action="/standards/toggle"><input type="hidden" name="id" value="${profile.id}"><input type="hidden" name="client_key" value="${escapeAttribute(profile.clientKey)}"><input type="hidden" name="action" value="${profile.isActive ? "deactivate" : "activate"}"><button class="btn" type="submit">${profile.isActive ? "Deactivate" : "Activate"}</button></form>
      <form method="post" action="/standards/delete" onsubmit="return confirm('Delete this campaign standard?')"><input type="hidden" name="id" value="${profile.id}"><input type="hidden" name="client_key" value="${escapeAttribute(profile.clientKey)}"><button class="btn" type="submit">Delete</button></form>
    </div>
    <details class="edit-panel"><summary>Edit standard</summary>${renderProfileForm(profile, "/standards/update", "Save changes")}</details>
  </article>`;
}

function renderProfileForm(profile, action, buttonLabel) {
  const term = profile.fields?.term ?? {};
  const content = profile.fields?.content ?? {};
  return `<form method="post" action="${action}" class="form-grid">
    ${profile.id ? `<input type="hidden" name="id" value="${profile.id}">` : ""}
    <input type="hidden" name="client_key" value="${escapeAttribute(profile.clientKey)}">
    ${field("Priority", "priority", profile.priority ?? 1, "number")}
    ${field("Display order", "sort_order", profile.sortOrder ?? 0, "number")}
    ${field("Campaign", "campaign", profile.campaign)}
    ${field("Display name", "display_name", profile.displayName)}
    <div class="field span-2"><label>Aliases</label><input name="aliases" value="${escapeAttribute((profile.aliases ?? []).join(", "))}" placeholder="News, Articles"></div>
    <div class="field"><label>Source</label><input name="source" value="${escapeAttribute(profile.source)}" placeholder="MetaAd"></div>
    <div class="field"><label>Medium</label><input name="medium" value="${escapeAttribute(profile.medium)}" placeholder="Social"></div>
    <div class="field full"><label>Campaign guideline</label><textarea name="guideline" required>${escapeHtml(profile.guideline)}</textarea></div>
    ${field("Term label", "term_label", term.label)}
    ${field("Term example", "term_placeholder", term.placeholder)}
    <div class="field span-2"><label>Term guidance</label><textarea name="term_help">${escapeHtml(term.help)}</textarea></div>
    ${field("Content label", "content_label", content.label)}
    ${field("Content example", "content_placeholder", content.placeholder)}
    <div class="field span-2"><label>Content guidance</label><textarea name="content_help">${escapeHtml(content.help)}</textarea></div>
    <label class="check"><input type="checkbox" name="is_active" value="1"${profile.isActive !== false ? " checked" : ""}> Active in builder</label>
    <div class="field"><button class="btn btn-primary" type="submit">${escapeHtml(buttonLabel)}</button></div>
  </form>`;
}

function field(label, name, value, type = "text") {
  return `<div class="field"><label>${escapeHtml(label)}</label><input type="${type}" name="${name}" value="${escapeAttribute(value ?? "")}"${type === "number" ? ' min="0"' : ""}></div>`;
}

function withActive(form) {
  return { ...form, is_active: form.is_active === "1" };
}

function redirect(client, message, level) {
  return NodeResponse.redirect(`/standards?${new URLSearchParams({
    client: client || "",
    toast: message || "Unable to update campaign standards.",
    toast_level: level
  }).toString()}`);
}

function humanize(value) {
  return String(value ?? "").replace(/_/gu, " ").replace(/\b\w/gu, (match) => match.toUpperCase());
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(value ?? "");
  }
}
