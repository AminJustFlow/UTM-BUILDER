import { BRAND_HEAD_HTML, renderIcon, renderJustFlowShellStyles, renderJustFlowSidebar, renderJustFlowThemeScript, renderJustFlowTopbar } from "../controllers/app-shell.js";

const UTM_FIELDS = ["campaign", "source", "medium", "term", "content"];
const FIELD_GUIDANCE = [
  { key: "campaign", label: "Campaign", meaning: "Reporting campaign or category", example: "Collateral" },
  { key: "source", label: "Source", meaning: "Traffic source or platform", example: "Facebook" },
  { key: "medium", label: "Medium", meaning: "Marketing channel type", example: "Social" },
  { key: "term", label: "Term", meaning: "Optional page, audience, or category detail", example: "FallOpenHouse" },
  { key: "content", label: "Content", meaning: "Optional message, CTA, or creative detail", example: "FrontPanel" }
];

export function renderUtmBuilderHtml(view) {
  const mode = view.mode === "edit" ? "edit" : "create";
  const isDuplicate = view.mode === "duplicate";
  const defaults = view.formDefaults ?? {};
  const clientOptions = view.clients
    .map((client) => `<option value="${escapeAttribute(client.key)}"${client.key === defaults.client ? " selected" : ""}>${escapeHtml(formatClientOptionLabel(client.displayName || client.key))}</option>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${BRAND_HEAD_HTML}
  <title>${isDuplicate ? "Duplicate Link" : mode === "edit" ? "Edit Link" : "Create Link"}</title>
  <style>${renderStyles()}</style>
</head>
<body>
  ${renderJustFlowThemeScript()}
  <div class="app">
    ${renderJustFlowSidebar("builder", { standaloneUtm: view.standalone, user: view.user })}
    <main class="main">
      ${renderJustFlowTopbar({ section: "UTM Builder", title: isDuplicate ? "Duplicate Link" : mode === "edit" ? "Edit Link" : "New Link", searchPlaceholder: "Search clients, campaigns, links...", showSearch: !view.standalone })}
      <div class="page">
        <div class="builder-flow">
          <div class="page-header">
            <div class="page-title-block">
              ${isDuplicate || mode === "edit" ? `<div class="eyebrow">${isDuplicate ? "Duplicate mode" : "Edit mode"}</div>` : ""}
              <h1>${isDuplicate ? "Duplicate a tracked link" : mode === "edit" ? "Edit a tracked link" : "Create a tracked link"}</h1>
              <p class="subtitle">${isDuplicate
                ? "This is a new link prefilled from the selected library entry. Change the source, medium, or any other needed field before creating it."
                : mode === "edit"
                ? "Update this saved link in the same guided builder while keeping campaign, source, and medium aligned with historical UTM usage."
                : "Use the existing tracked-link workflow, but choose campaign, source, and medium against historical UTM usage so reporting stays consistent."}</p>
            </div>
            <div class="page-actions">
              <a class="btn" href="/utms">${renderIcon("link")} Link Library</a>
              <a class="btn btn-primary" href="#builder-form">${renderIcon("sparkle")} Start builder</a>
            </div>
          </div>

          ${isDuplicate ? '<div class="summary-banner"><div class="summary-text"><b>Creating a new copy.</b> The original link will not be changed. At least the destination or one UTM value must differ.</div></div>' : ""}

          <section class="card">
            <div class="card-header">
              <div>
                <h3>${mode === "edit" ? "What happens on save" : "What will be filled in"}</h3>
                <div class="meta">${mode === "edit"
                  ? "Saving changes creates a new version of this link. If the same tracked link already exists, the app reuses the matching short link instead of creating a duplicate."
                  : "Choose a client, then fill the UTM values directly. The builder shows what already exists, how often it was used, similar historical UTMs, and last-year examples before you create the link."}</div>
              </div>
            </div>
            <div class="card-body">
              <div class="guide-grid">${FIELD_GUIDANCE.map(renderGuideCard).join("")}</div>
            </div>
          </section>

          <div class="builder-layout">
            <section class="card">
              <div class="card-header">
                <div>
                  <h3>Link details</h3>
                  <div class="meta">${mode === "edit"
                    ? "Edit the destination, client, and UTM values in one pass. This page uses the same guided builder as new link creation."
                    : "Fill the destination, client, and UTM values in one pass. The save flow is unchanged, and the builder now treats the UTM fields as the primary input."}</div>
                </div>
                <div class="pill" id="channel-summary">Channel is assigned automatically from Source and Medium.</div>
              </div>
              <div class="card-body">
                <div class="alert-row ok" id="result-celebration" hidden><div><div class="title">🎉 Nailed it!</div><div class="body">Your UTM values are clean, consistent, and ready to shine.</div></div></div>
                <form id="builder-form">
                  <div class="form-grid">
                    <label class="field full"><span>Destination URL</span>
                      <input type="url" name="destination_url" id="destination_url" required placeholder="https://example.com/page" value="${escapeAttribute(defaults.destination_url ?? "")}">
                      <div class="query-url-notice" id="destination-query-notice" style="display:none">This URL already has query parameters, so UTM values will be added with &amp; instead of another ?.</div>
                    </label>
                    <label class="checkbox-row full">
                      <input type="checkbox" name="external_domain" id="external_domain"${defaults.external_domain ? " checked" : ""}>
                      <span><strong>External domain</strong><br><span class="helper-copy" id="external-domain-help">Automatically selected when the destination is outside the selected client's domains.</span></span>
                    </label>
                    <label class="field"><span>Client</span>
                      <select name="client" id="client" required>
                        <option value="">Select a client</option>
                        ${clientOptions}
                      </select>
                    </label>
                    <label class="checkbox-row full"${mode === "edit" ? " hidden" : ""}>
                      <input type="checkbox" name="needs_qr" id="needs_qr"${mode !== "edit" && defaults.needs_qr ? " checked" : ""}>
                      <span>${mode === "edit" ? "Create a QR code for this version." : "Create a QR code too."}</span>
                    </label>
                    <div class="field full" id="qr-project-picker"${mode === "edit" || !defaults.needs_qr ? " hidden" : ""}>
                      <span>QR Stuff project</span>
                      <input type="search" id="qr-project-search" placeholder="Search project names" autocomplete="off">
                      <select id="qr_project_id" name="qr_project_id"${mode !== "edit" && defaults.needs_qr ? " required" : ""} disabled>
                        <option value="">Loading QR Stuff projects...</option>
                      </select>
                      <div class="helper-copy" id="qr-project-status">Choose the project where this QR code should be created.</div>
                      <button type="button" class="mini-button" id="qr-project-retry" hidden>Retry loading projects</button>
                    </div>
                  </div>
                  <input type="hidden" name="campaign_label" id="campaign_label" value="${escapeAttribute(defaults.campaign_label ?? "")}">
                  <input type="hidden" name="original_request_id" id="original_request_id" value="${escapeAttribute(defaults.original_request_id ?? "")}">
                  <input type="hidden" name="duplicated_from_request_id" id="duplicated_from_request_id" value="${escapeAttribute(defaults.duplicated_from_request_id ?? "")}">

                  ${mode === "edit" ? `<div class="inline-divider"><div><h3>Admin editing and assets</h3><div class="meta">The current version will be archived after its replacement is saved.</div></div></div>
                  <div class="form-grid">
                    <label class="field"><span>Channel</span><input type="text" id="edit_channel" value="${escapeAttribute(defaults.channel ?? "")}" required></label>
                    <label class="field"><span>Asset type</span><input type="text" id="edit_asset_type" value="${escapeAttribute(defaults.asset_type ?? "link")}" required></label>
                    <label class="field full"><span>Bitly action</span><select id="bitly_action"><option value="repoint">Keep and repoint existing Bitly</option><option value="manual">Replace with a supplied short URL</option><option value="generate">Generate a new Bitly</option></select></label>
                    <label class="field full" id="manual-short-shell" hidden><span>Replacement short URL</span><input type="url" id="manual_short_url" placeholder="https://bit.ly/example"></label>
                    <label class="field full"><span>QR action</span><select id="qr_action"><option value="keep">Keep current QR PDF</option><option value="upload">Upload replacement PDF</option><option value="remove">Remove QR</option></select></label>
                    <label class="field full" id="qr-upload-shell" hidden><span>Replacement QR PDF (maximum 10 MB)</span><input type="file" id="qr_pdf" accept="application/pdf,.pdf"></label>
                    <div class="helper-copy full">Current Bitly: ${escapeHtml(defaults.short_url || "None")} · Current QR: ${escapeHtml(defaults.qr_url || "None")}</div>
                  </div>` : ""}

                  <div class="inline-divider">
                    <div>
                      <h3>UTM values</h3>
                      <div class="meta">Campaign tracking details</div>
                      <div class="status-note">These fields are part of the normal flow now. Known standardized values are marked, and free-text override still stays visible as a new value.</div>
                    </div>
                    <div class="pill" id="advanced-summary">No UTM values entered yet.</div>
                  </div>

                  <div class="tracking-loading-shell" id="tracking-loading-shell">

                  <div class="summary-banner" id="client-guidance" style="display:none"><div class="summary-text" id="client-guidance-copy"></div></div>

                  <section class="campaign-standards" id="campaign-standards" style="display:none">
                    <div class="campaign-standards-head">
                      <div>
                        <h3>Client campaign standards</h3>
                        <div class="meta">Start with priority 1. Use priorities 2 and 3 only when no higher-priority campaign fits.</div>
                      </div>
                      <span class="pill" id="campaign-standards-count"></span>
                    </div>
                    <div class="campaign-standards-grid" id="campaign-standards-grid"></div>
                  </section>

                  <div class="context-block consistency-inline">
                    <h3>Consistency warnings</h3>
                    <div class="helper-copy" id="warning-empty">Checks compare your values and their combination with this client's history. New or unfamiliar choices require one confirmation.</div>
                    <div class="warning-list" id="warning-list"></div>
                  </div>

                  <div class="advanced-grid">
                    ${renderCombobox("campaign", "Campaign", "Reporting campaign or category", "Collateral", defaults.utm_campaign)}
                    ${renderCombobox("source", "Source", "Traffic source or platform", "Facebook", defaults.utm_source)}
                    ${renderCombobox("medium", "Medium", "Marketing channel type", "Social", defaults.utm_medium)}
                    ${renderCombobox("term", "Term", "Optional page, audience, or category detail", "FallOpenHouse", defaults.utm_term)}
                    ${renderCombobox("content", "Content", "Optional message, CTA, or creative detail", "FrontPanel", defaults.utm_content, true)}
                  </div>

                  <div class="actions">
                    <button class="btn btn-primary" type="submit" data-submit>${isDuplicate ? "Create Duplicate" : mode === "edit" ? "Save Changes" : "Create Link"}</button>
                    <button class="btn" type="reset">${mode === "edit" ? "Reset Changes" : "Clear"}</button>
                    ${mode === "edit" ? '<a class="btn btn-ghost" href="/utms">Back to library</a>' : ""}
                    <div class="status" id="form-status" aria-live="polite"></div>
                  </div>
                  </div>
                </form>
              </div>
            </section>

            <aside class="card context-card">
              <div class="card-header">
                <div>
                  <h3>UTM context</h3>
                  <div class="meta">This stays progressive. It only fills in once enough inputs are selected.</div>
                </div>
              </div>
              <div class="card-body context-stack">
                <div class="context-block">
                  <h3>Resolved preview</h3>
                  <div class="helper-copy" id="preview-empty">Choose a client and destination URL to see the resolved UTM values before link creation.</div>
                  <div class="preview-grid" id="preview-grid"></div>
                </div>
                <div class="context-block">
                  <h3>Usage counts</h3>
                  <div class="helper-copy" id="count-empty">Counts appear once campaign, source, or medium is selected.</div>
                  <div class="context-list" id="count-list"></div>
                </div>
                <div class="context-block">
                  <h3>Combination stats</h3>
                  <div class="helper-copy" id="combo-copy">Pick campaign, source, or medium to see how often the combination already exists.</div>
                </div>
                <div class="context-block">
                  <h3>Recommended next values</h3>
                  <div class="helper-copy" id="recommend-empty">Choose a campaign, source, or medium to see the most common historical next choice.</div>
                  <div class="warning-list" id="recommend-list"></div>
                </div>
                <div class="context-block">
                  <h3>Similar historical UTMs</h3>
                  <div class="helper-copy" id="history-empty">Historical examples appear after you start selecting UTM values.</div>
                  <div class="context-list" id="history-list"></div>
                </div>
                <div class="context-block">
                  <h3>Last year</h3>
                  <div class="helper-copy" id="last-year-empty">Last-year examples appear when matching history exists.</div>
                  <div class="context-list" id="last-year-list"></div>
                </div>
                <div class="context-block">
                  <h3>Term and content examples</h3>
                  <div class="helper-copy" id="related-empty">These stay light until a campaign is chosen.</div>
                  <div class="warning-list" id="related-list"></div>
                </div>
              </div>
            </aside>
          </div>

          <section class="result-shell" id="result-shell">
            <article class="card result-card">
              <div class="card-header">
                <div>
                  <h3 id="result-title">Link ready</h3>
                  <div class="meta" id="result-subtitle"></div>
                </div>
              </div>
              <div class="card-body">
                <section>
                  <h3 style="margin-bottom:.75rem">Links</h3>
                  <div class="result-links" id="result-links"></div>
                </section>
                <section>
                  <h3 style="margin-bottom:.75rem">UTM values</h3>
                  <div class="utm-grid" id="result-utm-grid"></div>
                </section>
                <div class="warning-list" id="result-actions"></div>
                <div class="warning-list" id="result-warnings"></div>
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  </div>
  <script>${renderClientScript(view.clients, mode)}</script>
</body>
</html>`;
}

function formatClientOptionLabel(value) {
  return String(value ?? "").trim().toUpperCase();
}

function renderGuideCard(field) {
  return `<div class="guide-card"><strong id="${escapeAttribute(field.key)}-guide-label">${escapeHtml(field.label)}</strong><span id="${escapeAttribute(field.key)}-guide-copy">${escapeHtml(field.meaning)}. Example: <code>${escapeHtml(field.example)}</code></span></div>`;
}

function renderCombobox(field, label, description, example, value = "", full = false) {
  return `<div class="combo-card${full ? " full" : ""}" id="${escapeAttribute(field)}-combo-card" aria-busy="false">
    <div class="field-loading-overlay" id="${escapeAttribute(field)}-field-loading" hidden role="status" aria-live="polite"><span class="loading-spinner" aria-hidden="true"></span><span>Loading ${escapeHtml(label)} recommendations…</span></div>
    <div class="combo-head">
      <div>
        <strong id="${escapeAttribute(field)}-label">${escapeHtml(label)}</strong>
        <div class="combo-subtitle" id="${escapeAttribute(field)}-guidance">${escapeHtml(description)}. Example: <code>${escapeHtml(example)}</code></div>
      </div>
      <span class="known-state" id="${escapeAttribute(field)}-known-state">No override entered.</span>
    </div>
    <input class="combo-input" type="text" id="utm_${escapeAttribute(field)}" autocomplete="off" spellcheck="false" placeholder="${escapeAttribute(example)}" value="${escapeAttribute(value ?? "")}">
    <div class="suggestions" id="${escapeAttribute(field)}-suggestions"></div>
  </div>`;
}

function renderStyles() {
  return `${renderJustFlowShellStyles()}
    .builder-flow{display:flex;flex-direction:column;gap:16px}.eyebrow{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius-sm);background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}.guide-grid{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}.guide-card{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.guide-card strong{display:block;margin-bottom:4px;font-size:12.5px}.guide-card span{display:block;color:var(--text-2);font-size:12px;line-height:1.45}.guide-card code{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--accent)}.builder-layout{display:grid;gap:20px;grid-template-columns:minmax(0,1fr) 340px;align-items:start}.form-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.full{grid-column:1/-1}.field span{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em}.query-url-notice{margin-top:6px;color:var(--warn);font-size:12.5px;line-height:1.45;text-transform:none;letter-spacing:0}.checkbox-row{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text);font-size:13px}.checkbox-row input{width:auto;margin-top:2px;accent-color:var(--accent)}.inline-divider{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;padding-top:14px;margin:16px 0 12px;border-top:1px solid var(--border)}.inline-divider h3{font-size:14px;margin:0}.status-note,.helper-copy,.empty{color:var(--text-2);line-height:1.5;font-size:12.5px}.campaign-standards{display:grid;gap:12px;margin:0 0 12px;padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2)}.campaign-standards-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.campaign-standards-head h3{font-size:14px;margin:0 0 3px}.campaign-standards-grid{display:grid;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr));max-height:420px;overflow:auto}.campaign-standard{display:grid;gap:7px;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface)}.campaign-standard.active{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}.campaign-standard-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.campaign-standard-head strong{font-size:13px}.campaign-standard-copy{font-size:12px;line-height:1.45;color:var(--text-2)}.campaign-standard-details{display:grid;gap:3px;font-size:11.5px;color:var(--text-3)}.campaign-standard-details b{color:var(--text-2)}.advanced-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}.combo-card{position:relative;display:grid;gap:7px;padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2)}.combo-card.full{grid-column:1/-1}.combo-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.combo-head strong{font-size:13px}.combo-subtitle{font-size:12px;color:var(--text-2);line-height:1.4}.combo-subtitle code{font-family:"IBM Plex Mono",monospace;font-size:11.5px}.combo-input{padding-right:40px}.known-state{font-size:11.5px;color:var(--text-3);white-space:nowrap}.known-state.known{color:var(--pos)}.known-state.new{color:var(--warn)}.suggestions{position:absolute;top:calc(100% - 4px);left:12px;right:12px;display:none;z-index:40;padding:6px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-lg);max-height:272px;overflow:auto}.suggestions.visible{display:grid;gap:4px}.suggestion-button{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;width:100%;padding:9px 10px;border:0;border-radius:var(--radius-sm);background:var(--surface-2);cursor:pointer;text-align:left;color:var(--text);font:inherit}.suggestion-button:hover,.suggestion-button:focus-visible{background:var(--accent-soft);outline:none}.suggestion-main{display:grid;gap:2px}.suggestion-help{font-size:11.5px;color:var(--text-3);line-height:1.4}.pill{display:inline-flex;align-items:center;min-height:24px;padding:2px 8px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface-2);font-size:11.5px;color:var(--text-2);white-space:nowrap}.pill.warning{background:var(--warn-soft);border-color:transparent;color:var(--warn)}.pill.success{background:var(--pos-soft);border-color:transparent;color:var(--pos)}.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px}.mini-button,.ghost-button{height:28px;padding:0 9px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font:inherit;font-size:12px;font-weight:500;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.mini-button:hover,.ghost-button:hover{background:var(--surface-2)}.status{min-height:20px;font-size:12.5px;color:var(--text-2)}.status.error{color:var(--neg)}.status.success{color:var(--pos)}.status.warning{color:var(--warn)}.context-card{position:sticky;top:76px}.context-card,.context-card .card-body,.context-stack,.context-block,.preview-grid,.context-list{min-width:0;max-width:100%}.context-stack{display:grid;gap:10px}.context-block{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);overflow:hidden}.context-block h3{font-size:12.5px;margin:0 0 4px}.context-list{display:grid;gap:6px;margin-top:8px}.history-item,.preview-row,.count-row{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;align-items:start}.history-item{grid-template-columns:minmax(0,1fr) auto;padding:8px 10px;border:1px dashed var(--border-strong);border-radius:var(--radius-sm);background:var(--surface)}.preview-grid{display:grid;gap:7px;margin-top:8px}.preview-row strong,.count-row strong{font-size:12px}.preview-row span,.count-row span,.history-item div,.link-value,.utm-value{display:block;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:break-word;text-align:left}.warning-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;min-width:0}.context-block .pill,.warning-list .pill{max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:break-word}.result-shell{display:none}.result-shell.visible{display:block}.result-links,.utm-grid{display:grid;gap:10px}.utm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.link-item,.utm-item{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.link-label,.utm-item strong{display:block;margin-bottom:4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}.link-value,.utm-value{display:block;line-height:1.5;word-break:break-word;color:var(--text);font-family:"IBM Plex Mono",monospace;font-size:12.5px}.link-value{color:var(--accent);text-decoration:none}.link-value:hover{text-decoration:underline}
    .tracking-loading-shell{position:relative}.field-loading-overlay{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;border-radius:var(--radius);background:rgba(255,255,255,.94);color:var(--text-2);font-size:12px;font-weight:600}[data-theme=dark] .field-loading-overlay{background:rgba(22,22,26,.95)}.field-loading-overlay[hidden]{display:none}.loading-spinner{width:17px;height:17px;flex:0 0 auto;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:loading-spin .7s linear infinite}.suggestion-loading{display:flex;align-items:center;gap:8px;padding:9px 10px;color:var(--text-2);font-size:12px}.suggestion-loading .loading-spinner{width:14px;height:14px}@keyframes loading-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.loading-spinner{animation-duration:1.5s}}
    .builder-layout>.card,.builder-layout>.card>.card-body{overflow:visible}.combo-card:focus-within{z-index:80}.combo-card.disabled{opacity:.6}.combo-card.disabled .combo-input{cursor:not-allowed}
    #result-celebration[hidden]{display:none!important}
    .consistency-inline{margin:0 0 12px}
    @media (max-width:1200px){.builder-layout{grid-template-columns:1fr}.context-card{position:static}.guide-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media (max-width:860px){.advanced-grid,.guide-grid,.utm-grid,.form-grid,.campaign-standards-grid{grid-template-columns:1fr}}
  `;
}

function renderClientScript(clients = [], mode = "create") {
  return `(function(){
    const EDIT_MODE=${JSON.stringify(mode === "edit")};
    const UTM_FIELDS=${JSON.stringify(UTM_FIELDS)};
    const DEFAULT_FIELD_GUIDANCE=${serializeJson(Object.fromEntries(FIELD_GUIDANCE.map((field)=>[field.key,{label:field.label,help:field.meaning,placeholder:field.example}])))};
    const CLIENT_GUIDANCE=${serializeJson(Object.fromEntries(clients.map((client)=>[client.key,client.guidance||{}])))};
    const CLIENT_META=${serializeJson(Object.fromEntries(clients.map((client)=>[client.key,{domains:client.domains||[],externalSourceKey:client.externalSourceKey||client.key.toUpperCase()}])))};
    const form=document.getElementById("builder-form");
    const resultShell=document.getElementById("result-shell");
    const status=document.getElementById("form-status");
    const clientSelect=document.getElementById("client");
    const destinationInput=document.getElementById("destination_url");
    const destinationQueryNotice=document.getElementById("destination-query-notice");
    const externalDomainInput=document.getElementById("external_domain");
    const externalDomainHelp=document.getElementById("external-domain-help");
    const qrInput=document.getElementById("needs_qr");
    const qrProjectPicker=document.getElementById("qr-project-picker");
    const qrProjectSearch=document.getElementById("qr-project-search");
    const qrProjectSelect=document.getElementById("qr_project_id");
    const qrProjectStatus=document.getElementById("qr-project-status");
    const qrProjectRetry=document.getElementById("qr-project-retry");
    const originalRequestInput=document.getElementById("original_request_id");
    const duplicatedFromInput=document.getElementById("duplicated_from_request_id");
    const campaignLabelInput=document.getElementById("campaign_label");
    const editChannel=document.getElementById("edit_channel"),editAssetType=document.getElementById("edit_asset_type"),bitlyAction=document.getElementById("bitly_action"),manualShortShell=document.getElementById("manual-short-shell"),manualShortUrl=document.getElementById("manual_short_url"),qrAction=document.getElementById("qr_action"),qrUploadShell=document.getElementById("qr-upload-shell"),qrPdf=document.getElementById("qr_pdf");
    const channelSummary=document.getElementById("channel-summary");
    const advancedSummary=document.getElementById("advanced-summary");
    const clientGuidance=document.getElementById("client-guidance");
    const clientGuidanceCopy=document.getElementById("client-guidance-copy");
    const campaignStandards=document.getElementById("campaign-standards");
    const campaignStandardsGrid=document.getElementById("campaign-standards-grid");
    const campaignStandardsCount=document.getElementById("campaign-standards-count");
    const submitButton=form.querySelector("[data-submit]");
    const knownStateNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById(field+"-known-state")]));
    const inputNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById("utm_"+field)]));
    const listNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById(field+"-suggestions")]));
    const comboCardNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById(field+"-combo-card")]));
    const fieldLoadingNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById(field+"-field-loading")]));
    const suggestionState=Object.fromEntries(UTM_FIELDS.map((field)=>[field,[]]));
    const suggestionRequestIds=Object.fromEntries(UTM_FIELDS.map((field)=>[field,0]));
    const suggestionControllers=Object.fromEntries(UTM_FIELDS.map((field)=>[field,null]));
    const suggestionCache=new Map();
    const state={requestNonce:0,recommendationLoadToken:0,activeRecommendationField:null,queuedSubmission:false,submitting:false,pendingConsistencyFingerprint:null,confirmedConsistencyFingerprint:null,pendingConsistencyWarnings:[],currentConsistencyWarnings:[],externalOverride:null,externalDetectionKey:"",externalActive:false,normalValues:{}};

    function queryString(values){const params=new URLSearchParams();Object.entries(values||{}).forEach(([key,value])=>{if(value===null||value===undefined||value===""){return}params.set(key,String(value))});return params.toString()}
    async function fetchJson(url,options){const response=await fetch(url,options);const body=await response.json();if(!response.ok||body.status!=="ok"){const error=new Error(body&&body.error&&body.error.message?body.error.message:"Request failed.");error.code=body&&body.error?body.error.code:null;error.existing=body&&body.error?body.error.existing:null;error.consistencyWarnings=body&&body.error?body.error.consistency_warnings||[]:[];error.consistencyFingerprint=body&&body.error?body.error.consistency_warning_fingerprint:null;throw error}return body}
    function showStatus(message,level){status.textContent=message||"";status.className="status"+(level?" "+level:"")}
    function showSubmitError(error,fallback){if(error&&error.code==="duplicate_utm"&&error.existing){status.className="status error";status.innerHTML=escapeHtml(error.message)+' <a class="link" href="'+escapeAttribute(error.existing.library_url||"/utms")+'">Open existing link</a>';return}if(error&&error.code==="consistency_confirmation_required"){state.pendingConsistencyFingerprint=error.consistencyFingerprint;state.pendingConsistencyWarnings=error.consistencyWarnings||[];renderConsistencyWarnings(state.pendingConsistencyWarnings,true);showStatus("Review the consistency warnings, then correct the values or create anyway.","warning");document.getElementById("warning-list").scrollIntoView({behavior:"smooth",block:"center"});return}showStatus(error&&error.message?error.message:fallback,"error")}
    function clearStatus(){showStatus("","")}
    function activeUtmFields(){return state.externalActive?["source","medium"]:UTM_FIELDS}
    function isActiveUtmField(field){return activeUtmFields().includes(field)}
    function nextAdvanceTarget(field){const fields=activeUtmFields();const index=fields.indexOf(field);if(index<0){return null}if(index<fields.length-1){return fields[index+1]}return state.externalActive?"submit":null}
    function focusAdvanceTarget(target){if(target==="submit"){submitButton.focus();return}if(target&&isActiveUtmField(target)&&inputNodes[target]&&!inputNodes[target].disabled){inputNodes[target].focus()}}
    function beginRecommendationLoading(field){if(!field||!isActiveUtmField(field)||state.activeRecommendationField){return null}const token=++state.recommendationLoadToken;state.activeRecommendationField=field;comboCardNodes[field].setAttribute("aria-busy","true");fieldLoadingNodes[field].hidden=false;inputNodes[field].disabled=true;submitButton.disabled=true;return token}
    function finishRecommendationLoading(field,token){if(!field||state.activeRecommendationField!==field||state.recommendationLoadToken!==token){return false}comboCardNodes[field].setAttribute("aria-busy","false");fieldLoadingNodes[field].hidden=true;inputNodes[field].disabled=!isActiveUtmField(field);state.activeRecommendationField=null;submitButton.disabled=state.submitting;return true}
    async function withRecommendationLoading(work,nextField,focusTarget=nextField){if(!nextField){let completed=false;try{await work();completed=true}catch(error){showStatus(error&&error.message?error.message:"Unable to load recommended values.","error")}if(completed){focusAdvanceTarget(focusTarget)}return}const token=beginRecommendationLoading(nextField);if(token===null){focusAdvanceTarget(focusTarget);return}let completed=false;try{await work();completed=true}catch(error){showStatus(error&&error.message?error.message:"Unable to load recommended values.","error")}finally{const cleared=finishRecommendationLoading(nextField,token);if(cleared&&state.queuedSubmission){state.queuedSubmission=false;form.requestSubmit();return}}if(completed){focusAdvanceTarget(focusTarget)}}
    function destinationHasQuery(value){try{return new URL(String(value||"").trim()).search.length>1}catch{return false}}
    function updateDestinationQueryNotice(){if(destinationQueryNotice){destinationQueryNotice.style.display=destinationHasQuery(destinationInput.value)?"":"none"}}
    function normalizedHost(value){try{return new URL(String(value||"").trim()).hostname.toLowerCase().replace(/^www\./,"").replace(/\.$/,"")}catch{return ""}}
    function destinationIsExternal(){const meta=CLIENT_META[clientSelect.value];const host=normalizedHost(destinationInput.value);if(!meta||!host){return false}return !(meta.domains||[]).some((domain)=>{const expected=String(domain||"").trim().toLowerCase().replace(/^www\./,"").replace(/\.$/,"");return expected&&(host===expected||host.endsWith("."+expected))})}
    function externalDetectionKey(){return clientSelect.value+"|"+normalizedHost(destinationInput.value)}
    function setExternalFieldState(active){if(active){state.recommendationLoadToken+=1;if(state.activeRecommendationField){const loadingField=state.activeRecommendationField;comboCardNodes[loadingField].setAttribute("aria-busy","false");fieldLoadingNodes[loadingField].hidden=true;inputNodes[loadingField].disabled=!isActiveUtmField(loadingField);state.activeRecommendationField=null}}['campaign','term','content'].forEach((field)=>{inputNodes[field].disabled=active;comboCardNodes[field].classList.toggle("disabled",active);if(active){inputNodes[field].value="";suggestionRequestIds[field]+=1;if(suggestionControllers[field]){suggestionControllers[field].abort();suggestionControllers[field]=null}suggestionState[field]=[];listNodes[field].innerHTML="";closeSuggestions(field);comboCardNodes[field].setAttribute("aria-busy","false");fieldLoadingNodes[field].hidden=true}})}
    function applyExternalMode(active,{defaults=true}={}){const client=clientSelect.value;if(active&&!state.externalActive){if(client){state.normalValues[client]=Object.fromEntries(UTM_FIELDS.map((field)=>[field,inputNodes[field].value]))}if(defaults){inputNodes.source.value=(CLIENT_META[client]&&CLIENT_META[client].externalSourceKey)||client.toUpperCase();inputNodes.medium.value="External"}}if(!active&&state.externalActive){const saved=state.normalValues[client];if(saved){UTM_FIELDS.forEach((field)=>{inputNodes[field].value=saved[field]||""})}}state.externalActive=active;externalDomainInput.checked=active;setExternalFieldState(active);if(active){["source","medium"].forEach((field)=>{suggestionRequestIds[field]+=1;if(suggestionControllers[field]){suggestionControllers[field].abort();suggestionControllers[field]=null}suggestionState[field]=externalStandardSuggestions(field)});state.queuedSubmission=false;state.pendingConsistencyFingerprint=null;state.confirmedConsistencyFingerprint=null;state.pendingConsistencyWarnings=[];state.currentConsistencyWarnings=[];renderConsistencyWarnings([],false)}renderKnownState("source");renderKnownState("medium");renderLoadedSuggestions();externalDomainHelp.textContent=active?"Only Source and Medium are used for this external destination.":"Automatically selected when the destination is outside the selected client's domains.";submitButton.disabled=state.submitting;updateAdvancedSummary();updateChannelSummary();updateClientGuidance()}
    function detectExternalMode(){const key=externalDetectionKey();if(key!==state.externalDetectionKey){state.externalDetectionKey=key;state.externalOverride=null}const detected=destinationIsExternal();applyExternalMode(state.externalOverride===null?detected:state.externalOverride)}
    function comparableUtmValue(value){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"")}
    function formatUtmInput(value){const text=String(value||"").trim();if(!text){return ""}const preservedWords={cpc:"CPC",gmb:"GMB",jf:"JF",ma:"MA",nh:"NH",pr:"PR",qr:"QR",seo:"SEO",utm:"UTM"};const preservedPhrases={linkedin:"LinkedIn",qrcode:"QRCode"};const phrase=preservedPhrases[text.toLowerCase()];if(phrase){return phrase}return text.replace(/([a-z0-9])([A-Z])/g,"$1 $2").split(/[^a-zA-Z0-9]+/g).filter(Boolean).map((token)=>{const normalized=token.toLowerCase();return preservedWords[normalized]||preservedPhrases[normalized]||token.charAt(0).toUpperCase()+token.slice(1)}).join("")}
    function currentSelection(){return{client:clientSelect.value||"",campaign:inputNodes.campaign.value.trim(),source:inputNodes.source.value.trim(),medium:inputNodes.medium.value.trim(),term:inputNodes.term.value.trim(),content:inputNodes.content.value.trim()}}
    function payloadForPreview(){const payload={client:clientSelect.value,destination_url:destinationInput.value.trim(),needs_qr:qrInput.checked,external_domain:externalDomainInput.checked};if(qrInput.checked&&qrProjectSelect.value){payload.qr_project_id=qrProjectSelect.value}UTM_FIELDS.forEach((field)=>{const value=inputNodes[field].value.trim();if(value){payload["utm_"+field]=value}});return payload}
    let qrProjects=[];let qrProjectsLoaded=false;
    function renderQrProjects(){const query=qrProjectSearch.value.trim().toLowerCase();const selected=qrProjectSelect.value;const filtered=qrProjects.filter((project)=>project.name.toLowerCase().includes(query));qrProjectSelect.innerHTML='<option value="">Select a QR Stuff project</option>'+filtered.map((project)=>'<option value="'+escapeAttribute(project.id)+'"'+(String(project.id)===selected?' selected':'')+'>'+escapeHtml(project.name)+'</option>').join('');qrProjectSelect.disabled=false;qrProjectStatus.textContent=filtered.length?'Choose the project where this QR code should be created.':'No projects match that search.'}
    async function loadQrProjects(force){qrProjectSelect.disabled=false;qrProjectSelect.innerHTML='<option value="">Loading QR Stuff projects...</option>';qrProjectStatus.textContent='Loading QR Stuff projects...';qrProjectRetry.hidden=true;try{const response=await fetch('/new/qr-projects.json'+(force?'?refresh=1':''),{headers:{Accept:'application/json'}});const body=await response.json();if(!response.ok||body.status!=='ok'){throw new Error(body&&body.error&&body.error.message?body.error.message:'Unable to load QR Stuff projects.')}qrProjects=Array.isArray(body.projects)?body.projects:[];qrProjectsLoaded=true;renderQrProjects();if(!qrProjects.length){qrProjectStatus.textContent='No QR Stuff projects are available.'}}catch(error){qrProjectsLoaded=false;qrProjectSelect.disabled=false;qrProjectSelect.innerHTML='<option value="">Projects unavailable</option>';qrProjectStatus.textContent=error.message||'Unable to load QR Stuff projects.';qrProjectRetry.hidden=false}}
    function updateQrProjectPicker(){qrProjectPicker.hidden=!qrInput.checked;qrProjectSelect.required=qrInput.checked;if(qrInput.checked&&!qrProjectsLoaded){loadQrProjects(false)}}
    function payloadForSubmit(){const payload=payloadForPreview();if(originalRequestInput&&originalRequestInput.value.trim()){payload.original_request_id=originalRequestInput.value.trim()}if(duplicatedFromInput&&duplicatedFromInput.value.trim()){payload.duplicated_from_request_id=duplicatedFromInput.value.trim()}if(campaignLabelInput&&campaignLabelInput.value.trim()){payload.campaign_label=campaignLabelInput.value.trim()}if(state.confirmedConsistencyFingerprint){payload.consistency_warning_fingerprint=state.confirmedConsistencyFingerprint}return payload}
    async function addEditAssets(payload){if(!EDIT_MODE)return payload;payload.channel=editChannel.value.trim();payload.asset_type=editAssetType.value.trim();payload.bitly_action=bitlyAction.value;payload.manual_short_url=manualShortUrl.value.trim();payload.qr_action=qrAction.value;if(payload.qr_action==="upload"){const file=qrPdf.files[0];if(!file)throw new Error("Choose a replacement QR PDF.");if(file.size>10*1024*1024)throw new Error("Replacement QR PDF must be 10 MB or smaller.");payload.qr_pdf_name=file.name;payload.qr_pdf_base64=await fileToBase64(file)}return payload}
    function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||"").split(",").pop()||"");reader.onerror=()=>reject(new Error("Unable to read the replacement QR PDF."));reader.readAsDataURL(file)})}
    function updateChannelSummary(){const medium=inputNodes.medium.value.trim().toLowerCase();const source=inputNodes.source.value.trim().toLowerCase();if(medium==="qrcode"||medium==="qr_code"||medium==="offline"){channelSummary.textContent="Channel is assigned as QR from Medium.";return}if(medium==="website"||medium==="domain"||medium==="email"||medium==="pr"){channelSummary.textContent="Channel is assigned automatically from Medium.";return}if(source==="facebook"||source==="instagram"||source==="linked_in"||source==="linkedin"){channelSummary.textContent="Channel is assigned automatically from Source.";return}channelSummary.textContent="Channel is assigned automatically from Source and Medium."}
    function updateAdvancedSummary(){const activeFields=UTM_FIELDS.filter((field)=>inputNodes[field].value.trim());advancedSummary.textContent=activeFields.length?"UTM values entered for: "+activeFields.join(", "):"No UTM values entered yet."}
    function activeCampaignProfile(guidance){const selected=comparableUtmValue(inputNodes.campaign.value);if(!selected){return null}return(guidance.campaignProfiles||[]).find((profile)=>[profile.campaign,profile.displayName].concat(profile.aliases||[]).some((value)=>comparableUtmValue(value)===selected))||null}
    function campaignFieldDetails(profile,field){if(!profile){return{}}if(field==="campaign"){return{help:profile.guideline,placeholder:profile.campaign}}if(field==="source"&&profile.source){return{label:"Source — Required value",help:"Use the specified source for this campaign.",placeholder:profile.source}}if(field==="medium"&&profile.medium){return{label:"Medium — Required value",help:"Use the specified medium for this campaign.",placeholder:profile.medium}}return(profile.fields&&profile.fields[field])||{}}
    function renderCampaignStandards(guidance,activeProfile){const profiles=guidance.campaignProfiles||[];if(!profiles.length){campaignStandards.style.display="none";campaignStandardsGrid.innerHTML="";campaignStandardsCount.textContent="";return}campaignStandards.style.display="";campaignStandardsCount.textContent=String(profiles.length)+" standards";campaignStandardsGrid.innerHTML=profiles.map((profile)=>{const details=[];if(profile.source){details.push("<span><b>Source:</b> "+escapeHtml(profile.source)+"</span>")}if(profile.medium){details.push("<span><b>Medium:</b> "+escapeHtml(profile.medium)+"</span>")}const term=profile.fields&&profile.fields.term;if(term&&term.help){details.push("<span><b>Term:</b> "+escapeHtml(term.help)+"</span>")}const content=profile.fields&&profile.fields.content;if(content&&content.help){details.push("<span><b>Content:</b> "+escapeHtml(content.help)+"</span>")}return'<article class="campaign-standard'+(profile===activeProfile?" active":"")+'" data-campaign-standard="'+escapeAttribute(profile.campaign)+'"><div class="campaign-standard-head"><strong>'+escapeHtml(profile.displayName||profile.campaign)+'</strong><span class="pill">Priority '+escapeHtml(String(profile.priority))+'</span></div><div class="campaign-standard-copy">'+escapeHtml(profile.guideline||"Follow the client campaign standard.")+'</div>'+(details.length?'<div class="campaign-standard-details">'+details.join("")+"</div>":"")+"</article>"}).join("")}
    function updateClientGuidance(){const guidance=CLIENT_GUIDANCE[clientSelect.value]||{};const fields=guidance.fields||{};const profile=activeCampaignProfile(guidance);UTM_FIELDS.forEach((field)=>{const defaults=DEFAULT_FIELD_GUIDANCE[field];const clientDetails=fields[field]||{};const profileDetails=campaignFieldDetails(profile,field);const details={label:profileDetails.label||clientDetails.label||defaults.label,help:profileDetails.help||clientDetails.help||defaults.help,placeholder:profileDetails.placeholder||clientDetails.placeholder||defaults.placeholder};document.getElementById(field+"-label").textContent=details.label;document.getElementById(field+"-guidance").innerHTML=escapeHtml(details.help)+'. Example: <code>'+escapeHtml(details.placeholder)+'</code>';document.getElementById(field+"-guide-label").textContent=details.label;document.getElementById(field+"-guide-copy").innerHTML=escapeHtml(details.help)+'. Example: <code>'+escapeHtml(details.placeholder)+'</code>';inputNodes[field].placeholder=details.placeholder});const summary=profile?((profile.displayName||profile.campaign)+": "+profile.guideline):guidance.summary||"";clientGuidanceCopy.textContent=summary;clientGuidance.style.display=summary?"":"none";renderCampaignStandards(guidance,profile)}
    function renderKnownState(field){const value=comparableUtmValue(inputNodes[field].value);const suggestions=suggestionState[field]||[];const exact=suggestions.find((item)=>comparableUtmValue(item.normalized_value||item.value)===value);const meta=CLIENT_META[clientSelect.value]||{};const externalKnown=state.externalActive&&((field==="source"&&value===comparableUtmValue(meta.externalSourceKey))||(field==="medium"&&value===comparableUtmValue("External")));const node=knownStateNodes[field];if(!value){node.textContent="No override entered.";node.className="known-state";return}if(externalKnown||(exact&&exact.known)){node.textContent="Known standardized value.";node.className="known-state known";return}node.textContent="Free-text new value.";node.className="known-state new"}
    function closeSuggestions(field){listNodes[field].classList.remove("visible")}
    function closeAllSuggestions(){UTM_FIELDS.forEach(closeSuggestions)}
    function renderSuggestionLoading(field){const list=listNodes[field];list.innerHTML='<div class="suggestion-loading" role="status"><span class="loading-spinner" aria-hidden="true"></span><span>Loading suggestions…</span></div>';list.classList.add("visible")}
    function renderSuggestions(field,items,typedValue){suggestionState[field]=items||[];renderKnownState(field);const list=listNodes[field];const typed=String(typedValue||"").trim();const typedComparable=comparableUtmValue(typed);const exactKnown=(items||[]).some((item)=>comparableUtmValue(item.normalized_value||item.value)===typedComparable);const rows=[];if(typed&&!exactKnown){rows.push('<button type="button" class="suggestion-button" data-new-value="true" data-field="'+escapeAttribute(field)+'" data-value="'+escapeAttribute(typed)+'"><span class="suggestion-main"><strong>Use new value</strong><span class="suggestion-help">'+escapeHtml(typed)+'</span></span><span class="pill warning">New</span></button>')}(items||[]).forEach((item)=>{const badge=item.recommended?'Recommended':(item.known?'Known':'New');const badgeClass=item.recommended?'success':(item.known?'success':'warning');rows.push('<button type="button" class="suggestion-button" data-field="'+escapeAttribute(field)+'" data-value="'+escapeAttribute(item.value)+'"><span class="suggestion-main"><strong>'+escapeHtml(item.value+" ("+String(item.count||0)+")")+'</strong>'+(item.relation?'<span class="suggestion-help">'+escapeHtml(item.relation)+'</span>':"")+'</span><span class="pill '+badgeClass+'">'+badge+'</span></button>')});if(!rows.length){list.innerHTML="";list.classList.remove("visible");return}list.innerHTML=rows.join("");list.classList.add("visible")}
    function externalStandardSuggestions(field){const meta=CLIENT_META[clientSelect.value]||{};const value=field==="source"?meta.externalSourceKey:(field==="medium"?"External":"");return value?[{value,normalized_value:comparableUtmValue(value),count:0,known:true,recommended:true,relation:"External-domain standard"}]:[]}
    async function loadSuggestions(field,query,showList){const requestId=++suggestionRequestIds[field];const previousItems=suggestionState[field]||[];if(state.externalActive){if(["campaign","term","content"].includes(field)){suggestionState[field]=[];listNodes[field].innerHTML="";closeSuggestions(field);renderKnownState(field);return}if(["source","medium"].includes(field)){const items=externalStandardSuggestions(field);if(showList){renderSuggestions(field,items,query)}else{suggestionState[field]=items;renderKnownState(field)}return}}if(!clientSelect.value){if(showList){renderSuggestions(field,[],query)}return}if(showList){renderSuggestionLoading(field)}const selection=currentSelection();const requestQuery=queryString({field,client:selection.client,campaign:selection.campaign,source:selection.source,medium:selection.medium,term:selection.term,content:selection.content,query});const cacheKey=field+"?"+requestQuery;const cached=suggestionCache.get(cacheKey);if(cached&&cached.expiresAt>Date.now()){if(showList){renderSuggestions(field,cached.items,query)}else{suggestionState[field]=cached.items;renderKnownState(field)}return}if(suggestionControllers[field]){suggestionControllers[field].abort()}const controller=new AbortController();suggestionControllers[field]=controller;try{const body=await fetchJson("/new/utm-intelligence/suggestions.json?"+requestQuery,{signal:controller.signal});if(requestId!==suggestionRequestIds[field]||state.externalActive){return}const items=body.items||[];suggestionCache.set(cacheKey,{items,expiresAt:Date.now()+30000});if(suggestionCache.size>75){suggestionCache.delete(suggestionCache.keys().next().value)}if(showList){renderSuggestions(field,items,query)}else{suggestionState[field]=items;renderKnownState(field)}}catch(error){if(error&&error.name==="AbortError"){return}if(requestId!==suggestionRequestIds[field]){return}if(showList){renderSuggestions(field,previousItems,query)}throw error}finally{if(suggestionControllers[field]===controller){suggestionControllers[field]=null}}}
    function renderPreview(preview){const grid=document.getElementById("preview-grid");const empty=document.getElementById("preview-empty");if(!preview||!preview.resolved){grid.innerHTML="";empty.style.display="";return}empty.style.display="none";const resolved=preview.resolved;grid.innerHTML=[["Campaign",resolved.utm_campaign],["Source",resolved.utm_source],["Medium",resolved.utm_medium],["Term",resolved.utm_term||"Not set"],["Content",resolved.utm_content||"Not set"],["Tracked URL",resolved.final_long_url]].map((entry)=>'<div class="preview-row"><strong>'+escapeHtml(entry[0])+'</strong><span>'+escapeHtml(entry[1]||"Not set")+'</span></div>').join("")}
    function renderCounts(context){const list=document.getElementById("count-list");const empty=document.getElementById("count-empty");const fields=context&&context.counts&&context.counts.fields?context.counts.fields:{};const rows=Object.entries(fields).map(([field,details])=>'<div class="count-row"><strong>'+escapeHtml(field)+'</strong><span>'+escapeHtml(String(details.count||0))+' scoped / '+escapeHtml(String(details.global_count||0))+' overall</span></div>');list.innerHTML=rows.join("");empty.style.display=rows.length?"none":"";const comboCopy=document.getElementById("combo-copy");if(context&&context.combination){const summary=context.combination.campaign_summary;comboCopy.textContent=summary?'Exact matches: '+String(context.combination.exact_match_count||0)+'. Campaign "'+summary.campaign+'" has '+String(summary.total_rows||0)+' rows across '+String(summary.unique_sources||0)+' sources and '+String(summary.unique_mediums||0)+' mediums.':'Exact matches: '+String(context.combination.exact_match_count||0)+'.'}}
    function renderHistoryList(targetId,emptyId,items){const list=document.getElementById(targetId);const empty=document.getElementById(emptyId);const rows=(items||[]).map((item)=>{const meta=[item.client?("Client: "+item.client):"",item.term?("Term: "+item.term):"",item.content?("Content: "+item.content):"",item.bitly?("Short link: "+item.bitly):""].filter(Boolean).join(" • ");return '<div class="history-item"><div><strong>'+escapeHtml(item.campaign+" / "+item.source+" / "+item.medium)+'</strong>'+(meta?'<div class="suggestion-help">'+escapeHtml(meta)+'</div>':"")+'<div class="suggestion-help">'+escapeHtml(item.destination_url||"")+'</div></div><span class="pill">'+escapeHtml(item.creation_date||"undated")+'</span></div>'});list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function recommendationFields(){return state.externalActive?["source","medium"]:UTM_FIELDS}
    function renderRecommendations(context){const list=document.getElementById("recommend-list");const empty=document.getElementById("recommend-empty");if(state.externalActive){const rows=["source","medium"].flatMap((field)=>externalStandardSuggestions(field).map((item)=>'<span class="pill success">'+escapeHtml(field+": "+item.value)+'</span>'));list.innerHTML=rows.join("");empty.style.display=rows.length?"none":"";return}const recommendations=context&&context.recommendations?context.recommendations:{};const allowed=new Set(recommendationFields());const rows=Object.entries(recommendations).filter(([field,item])=>allowed.has(field)&&item&&item.value).map(([field,item])=>'<span class="pill success">'+escapeHtml(field+": "+item.value+" ("+String(item.count||0)+")")+'</span>');list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function renderLoadedSuggestions(){const list=document.getElementById("recommend-list");const empty=document.getElementById("recommend-empty");const rows=[];recommendationFields().forEach((field)=>{(suggestionState[field]||[]).slice(0,3).forEach((item)=>rows.push('<button type="button" class="pill success" data-field="'+escapeAttribute(field)+'" data-value="'+escapeAttribute(item.value)+'">'+escapeHtml(field+": "+item.value+" ("+String(item.count||0)+")")+'</button>'))});list.innerHTML=rows.join("");empty.textContent=clientSelect.value?"No historical standards were found for this client.":"Recommendations appear as you make selections.";empty.style.display=rows.length?"none":""}
    async function loadClientHistory(){if(!clientSelect.value){renderHistoryList("history-list","history-empty",[]);return}const body=await fetchJson("/new/utm-intelligence/history.json?"+queryString({client:clientSelect.value,limit:6}));renderHistoryList("history-list","history-empty",body.items||[])}
    function renderRelated(context){const list=document.getElementById("related-list");const empty=document.getElementById("related-empty");const termItems=context&&context.related_examples&&context.related_examples.term?context.related_examples.term:[];const contentItems=context&&context.related_examples&&context.related_examples.content?context.related_examples.content:[];const rows=[].concat(termItems.map((item)=>'<span class="pill">term: '+escapeHtml(item.value)+' ('+escapeHtml(String(item.count||0))+')</span>')).concat(contentItems.map((item)=>'<span class="pill">content: '+escapeHtml(item.value)+' ('+escapeHtml(String(item.count||0))+')</span>'));list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function renderConsistencyWarnings(warnings,showActions){const list=document.getElementById("warning-list");const empty=document.getElementById("warning-empty");const rows=(warnings||[]).map((warning)=>{const label=String(warning.type||"warning").replace(/_/g," ");const recommendations=(warning.recommendations||[]).map((item)=>'<button type="button" class="pill success" data-field="'+escapeAttribute(item.field)+'" data-value="'+escapeAttribute(item.value)+'">Use '+escapeHtml(item.value)+' ('+escapeHtml(String(item.usage_count||0))+')</button>').join("");return '<div class="alert-row '+(warning.severity==="info"?'ok':'warn')+'"><div><div class="title">'+escapeHtml(label)+'</div><div class="body">'+escapeHtml(warning.message)+'</div>'+(recommendations?'<div class="warning-list">'+recommendations+'</div>':"")+'</div></div>'});if(showActions){rows.push('<div class="actions"><button type="button" class="mini-button" data-review-consistency>Review Values</button><button type="button" class="button" data-confirm-consistency>Create Anyway</button></div>')}list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function renderWarnings(preview,context){if(state.externalActive){state.currentConsistencyWarnings=[];state.pendingConsistencyWarnings=[];state.pendingConsistencyFingerprint=null;state.confirmedConsistencyFingerprint=null;renderConsistencyWarnings([],false);return}const consistency=context&&context.consistency?context.consistency:(preview&&preview.context?preview.context.consistency:null);const structured=consistency&&consistency.warnings?consistency.warnings:[];const legacy=[].concat((preview&&preview.resolved&&preview.resolved.warnings)||[]).map((warning)=>typeof warning==="string"?{type:"guidance",severity:"warning",message:warning,recommendations:[]}:{type:warning&&warning.type?warning.type:"guidance",severity:warning&&warning.severity?warning.severity:"warning",message:warning&&warning.message?warning.message:"",recommendations:warning&&warning.recommendations?warning.recommendations:[]}).filter((warning)=>warning.message);const messages=new Set(structured.map((item)=>item.message));const combined=structured.concat(legacy.filter((warning)=>!messages.has(warning.message)));state.currentConsistencyWarnings=combined;renderConsistencyWarnings(combined,false)}
    async function refreshContextAndPreview(){const payload=payloadForPreview();if(!payload.client){renderPreview(null);renderCounts(null);renderRecommendations(null);renderHistoryList("history-list","history-empty",[]);renderHistoryList("last-year-list","last-year-empty",[]);renderRelated(null);renderWarnings(null,null);clearStatus();return}const nonce=++state.requestNonce;try{const contextPromise=fetchJson("/new/utm-intelligence/context.json?"+queryString(payload));const previewPromise=payload.destination_url?fetchJson("/new/preview.json",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}):Promise.resolve({preview:null});const [previewBody,contextBody]=await Promise.all([previewPromise,contextPromise]);if(nonce!==state.requestNonce){return}renderPreview(previewBody.preview);renderCounts(contextBody);renderRecommendations(contextBody);renderHistoryList("history-list","history-empty",contextBody.similar_history?contextBody.similar_history.items:[]);renderHistoryList("last-year-list","last-year-empty",contextBody.last_year?contextBody.last_year.items:[]);renderRelated(contextBody);renderWarnings(previewBody.preview,contextBody);updateChannelSummary();clearStatus()}catch(error){if(nonce!==state.requestNonce){return}renderPreview(null);clearStatus()}}
    const debouncedRefresh=debounce(refreshContextAndPreview,350);
    const debouncedSuggestionLoads=Object.fromEntries(UTM_FIELDS.map((field)=>[field,debounce(async()=>{try{await loadSuggestions(field,inputNodes[field].value.trim(),true);if(field==="campaign"){await Promise.all([loadSuggestions("source",inputNodes.source.value.trim(),false),loadSuggestions("medium",inputNodes.medium.value.trim(),false),loadSuggestions("term",inputNodes.term.value.trim(),false),loadSuggestions("content",inputNodes.content.value.trim(),false)])}if(field==="source"){await loadSuggestions("medium",inputNodes.medium.value.trim(),listNodes.medium.classList.contains("visible"))}debouncedRefresh()}catch(error){if(error&&error.name!=="AbortError"){showStatus(error.message,"error")}}},180)]));
    document.addEventListener("click",async(event)=>{const confirmButton=event.target.closest("[data-confirm-consistency]");if(confirmButton){event.preventDefault();state.confirmedConsistencyFingerprint=state.pendingConsistencyFingerprint;form.requestSubmit();return}const reviewButton=event.target.closest("[data-review-consistency]");if(reviewButton){event.preventDefault();const field=state.pendingConsistencyWarnings.flatMap((item)=>item.fields||[])[0];if(field&&inputNodes[field]&&!inputNodes[field].disabled){inputNodes[field].focus()}return}const suggestion=event.target.closest("[data-field][data-value]");if(suggestion){event.preventDefault();if(state.activeRecommendationField){return}const field=suggestion.getAttribute("data-field");if(!isActiveUtmField(field)||inputNodes[field].disabled){return}const selectedValue=suggestion.getAttribute("data-value")||"";inputNodes[field].value=suggestion.hasAttribute("data-new-value")?formatUtmInput(selectedValue):selectedValue;state.confirmedConsistencyFingerprint=null;state.pendingConsistencyFingerprint=null;closeSuggestions(field);updateAdvancedSummary();updateChannelSummary();if(field==="campaign"){updateClientGuidance()}const target=nextAdvanceTarget(field);const nextField=target&&target!=="submit"?target:null;await withRecommendationLoading(async()=>{if(nextField){await loadSuggestions(nextField,inputNodes[nextField].value.trim(),false)}},nextField,target);loadSuggestions(field,inputNodes[field].value.trim(),false).then(renderLoadedSuggestions).catch(()=>{});refreshContextAndPreview();return}const copyButton=event.target.closest("[data-copy]");if(copyButton){event.preventDefault();try{await navigator.clipboard.writeText(copyButton.getAttribute("data-copy")||"");showStatus("Copied to clipboard.","success")}catch{showStatus("Copy failed.","error")}return}if(!event.target.closest(".combo-card")){closeAllSuggestions()}});
    clientSelect.addEventListener("change",async()=>{state.confirmedConsistencyFingerprint=null;state.pendingConsistencyFingerprint=null;suggestionCache.clear();if(state.externalActive){UTM_FIELDS.forEach((field)=>{inputNodes[field].value=""})}state.externalActive=false;detectExternalMode();updateChannelSummary();updateClientGuidance();await withRecommendationLoading(async()=>{if(clientSelect.value&&!state.externalActive){await loadSuggestions("campaign",inputNodes.campaign.value.trim(),false)}else{renderSuggestions("campaign",[],"")}},clientSelect.value&&!state.externalActive?"campaign":null);renderLoadedSuggestions();loadClientHistory().catch(()=>{});refreshContextAndPreview()});
    destinationInput.addEventListener("input",()=>{updateDestinationQueryNotice();detectExternalMode();debouncedRefresh()});
    externalDomainInput.addEventListener("change",()=>{state.externalOverride=externalDomainInput.checked;applyExternalMode(externalDomainInput.checked);debouncedRefresh()});
    qrInput.addEventListener("change",()=>{updateQrProjectPicker();debouncedRefresh()});
    qrProjectSearch.addEventListener("input",renderQrProjects);
    qrProjectRetry.addEventListener("click",()=>loadQrProjects(true));
    if(EDIT_MODE){bitlyAction.addEventListener("change",()=>{manualShortShell.hidden=bitlyAction.value!=="manual";manualShortUrl.required=bitlyAction.value==="manual"});qrAction.addEventListener("change",()=>{qrUploadShell.hidden=qrAction.value!=="upload";qrPdf.required=qrAction.value==="upload"})}
    UTM_FIELDS.forEach((field)=>{inputNodes[field].addEventListener("focus",()=>{loadSuggestions(field,inputNodes[field].value.trim(),true).catch((error)=>{if(error&&error.name!=="AbortError"){showStatus(error.message,"error")}})});inputNodes[field].addEventListener("input",()=>{state.confirmedConsistencyFingerprint=null;state.pendingConsistencyFingerprint=null;updateAdvancedSummary();updateChannelSummary();if(field==="campaign"){updateClientGuidance()}debouncedSuggestionLoads[field]()})});
    UTM_FIELDS.forEach((field)=>{inputNodes[field].addEventListener("blur",async()=>{const formattedValue=formatUtmInput(inputNodes[field].value);if(formattedValue!==inputNodes[field].value){inputNodes[field].value=formattedValue;state.confirmedConsistencyFingerprint=null;state.pendingConsistencyFingerprint=null;updateAdvancedSummary();updateChannelSummary();if(field==="campaign"){updateClientGuidance()}}try{await loadSuggestions(field,formattedValue,false);renderLoadedSuggestions();await refreshContextAndPreview()}catch(error){debouncedRefresh();showStatus(error.message,"error")}})});
    form.addEventListener("reset",()=>{window.setTimeout(()=>{state.externalOverride=null;state.externalActive=false;state.externalDetectionKey="";closeAllSuggestions();showStatus("","");resultShell.classList.remove("visible");updateQrProjectPicker();updateDestinationQueryNotice();detectExternalMode();updateChannelSummary();updateAdvancedSummary();updateClientGuidance();UTM_FIELDS.forEach((field)=>renderSuggestions(field,[],""));refreshContextAndPreview().catch(()=>{})},0)});
    form.addEventListener("submit",async(event)=>{event.preventDefault();if(!form.reportValidity()||state.submitting){return}if(state.activeRecommendationField){state.queuedSubmission=true;showStatus("Finishing recommended values…","");return}state.submitting=true;let payload=payloadForSubmit();const editing=EDIT_MODE;showStatus(editing?"Saving changes...":"Creating link...","");submitButton.disabled=true;try{payload=await addEditAssets(payload);const body=await fetchJson(editing?"/utms/edit":"/new",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});renderResult(body.result);showStatus(body.result.status==="completed_without_short_link"?(body.result.short_link_warning||"Tracked link saved without a short link."):(editing?"Changes saved. The previous version was archived.":"Link created."),body.result.status==="completed_without_short_link"?"warning":"success")}catch(error){showSubmitError(error,editing?"Unable to save changes right now.":"Unable to create the link right now.")}finally{state.submitting=false;submitButton.disabled=Boolean(state.activeRecommendationField)}});
    function renderResult(payload){document.getElementById("result-title").textContent=payload.message;document.getElementById("result-subtitle").textContent=payload.client_display_name+" | "+payload.channel_display_name;document.getElementById("result-links").innerHTML=[renderLinkItem("Tracked link",payload.tracked_url,"Tracked link not available."),renderLinkItem("Short link",payload.short_url,"Short link not available for this link."),renderLinkItem("QR code",payload.qr_url,"QR code not requested for this link.")].join("");document.getElementById("result-utm-grid").innerHTML=[["Source",payload.utm_source],["Medium",payload.utm_medium],["Campaign",payload.utm_campaign],["Term",payload.utm_term===""?"Not set":payload.utm_term],["Content",payload.utm_content===""?"Not set":payload.utm_content]].map((entry)=>'<div class="utm-item"><strong>'+escapeHtml(entry[0])+'</strong><div class="utm-value">'+escapeHtml(entry[1]||"Not set")+'</div></div>').join("");document.getElementById("result-actions").innerHTML=[payload.tracked_url?'<button type="button" class="mini-button" data-copy="'+escapeAttribute(payload.tracked_url)+'">Copy tracked link</button>':"",payload.short_url?'<button type="button" class="mini-button" data-copy="'+escapeAttribute(payload.short_url)+'">Copy short link</button>':"",payload.qr_url?'<button type="button" class="mini-button" data-copy="'+escapeAttribute(payload.qr_url)+'">Copy QR link</button>':"",payload.library_url?'<a class="ghost-button" href="'+escapeAttribute(payload.library_url)+'">Open in library</a>':""].join("");document.getElementById("result-warnings").innerHTML=(payload.warnings||[]).map((warning)=>'<span class="pill warning">'+escapeHtml(warning)+'</span>').join("");resultShell.classList.add("visible");resultShell.scrollIntoView({behavior:"smooth",block:"start"})}
    const renderResultBase=renderResult;
    renderResult=function(payload){const cleanUtms=state.currentConsistencyWarnings.length===0&&!(payload.warnings||[]).length;document.getElementById("result-celebration").hidden=!cleanUtms;renderResultBase(payload);if(payload.qr_url){const qrAction=[...document.querySelectorAll("#result-actions [data-copy]")].find((node)=>node.getAttribute("data-copy")===payload.qr_url);if(qrAction){qrAction.outerHTML='<a class="mini-button" href="'+escapeAttribute(payload.qr_url)+'">Download QR PDF</a>'}}if(cleanUtms){document.getElementById("result-title").textContent="UTM success!"}};
    function renderLinkItem(label,value,emptyMessage){if(!value){return '<div class="link-item"><div class="link-label">'+escapeHtml(label)+'</div><div class="empty">'+escapeHtml(emptyMessage)+'</div></div>'}return '<div class="link-item"><div class="link-label">'+escapeHtml(label)+'</div><a class="link-value" href="'+escapeAttribute(value)+'" target="_blank" rel="noreferrer">'+escapeHtml(value)+'</a></div>'}
    function debounce(fn,waitMs){let timer=null;return function(){clearTimeout(timer);timer=window.setTimeout(()=>fn.apply(null,arguments),waitMs)}}
    function escapeHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
    function escapeAttribute(value){return escapeHtml(value)}
    updateQrProjectPicker();updateDestinationQueryNotice();if(externalDomainInput.checked){state.externalOverride=true;state.externalDetectionKey=externalDetectionKey();applyExternalMode(true,{defaults:false})}else{detectExternalMode()}updateChannelSummary();updateAdvancedSummary();updateClientGuidance();UTM_FIELDS.forEach((field)=>renderSuggestions(field,[],""));refreshContextAndPreview().catch(()=>{})
  })();`;
}

function serializeJson(value) {
  return JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026");
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
