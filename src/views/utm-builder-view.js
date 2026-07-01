import { BRAND_HEAD_HTML, renderIcon, renderJustFlowShellStyles, renderJustFlowSidebar, renderJustFlowThemeScript, renderJustFlowTopbar } from "../controllers/app-shell.js";

const UTM_FIELDS = ["campaign", "source", "medium", "term", "content"];
const FIELD_GUIDANCE = [
  { key: "campaign", label: "Campaign", meaning: "Strategic bucket", example: "collateral" },
  { key: "source", label: "Source", meaning: "Specific asset", example: "cic_rack_card" },
  { key: "medium", label: "Medium", meaning: "Access method", example: "qr_code" },
  { key: "term", label: "Term", meaning: "Optional qualifier", example: "fall_open_house" },
  { key: "content", label: "Content", meaning: "Optional creative detail", example: "front_panel" }
];

export function renderUtmBuilderHtml(view) {
  const mode = view.mode === "edit" ? "edit" : "create";
  const isDuplicate = view.mode === "duplicate";
  const defaults = view.formDefaults ?? {};
  const clientOptions = view.clients
    .map((client) => `<option value="${escapeAttribute(client.key)}"${client.key === defaults.client ? " selected" : ""}>${escapeHtml(client.displayName)}</option>`)
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
              <div class="eyebrow">${isDuplicate ? "Duplicate mode" : mode === "edit" ? "Edit mode" : "Simple builder, upgraded"}</div>
              <h1>${isDuplicate ? "Duplicate a tracked link" : mode === "edit" ? "Edit a tracked link" : "Create a tracked link"}</h1>
              <p class="subtitle">${isDuplicate
                ? "This is a new link prefilled from the selected library entry. Change the platform or any other needed field before creating it."
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
                <div class="pill" id="channel-summary">Channel will resolve from your UTM values.</div>
              </div>
              <div class="card-body">
                <form id="builder-form">
                  <div class="form-grid">
                    <label class="field full"><span>Destination URL</span>
                      <input type="url" name="destination_url" id="destination_url" required placeholder="https://example.com/page" value="${escapeAttribute(defaults.destination_url ?? "")}">
                    </label>
                    <label class="field"><span>Client</span>
                      <select name="client" id="client" required>
                        <option value="">Select a client</option>
                        ${clientOptions}
                      </select>
                    </label>
                    <label class="checkbox-row full">
                      <input type="checkbox" name="needs_qr" id="needs_qr"${defaults.needs_qr ? " checked" : ""}>
                      <span>${mode === "edit" ? "Create a QR code for this version." : "Create a QR code too."}</span>
                    </label>
                  </div>
                  <input type="hidden" name="campaign_label" id="campaign_label" value="${escapeAttribute(defaults.campaign_label ?? "")}">
                  <input type="hidden" name="original_request_id" id="original_request_id" value="${escapeAttribute(defaults.original_request_id ?? "")}">
                  <input type="hidden" name="duplicated_from_request_id" id="duplicated_from_request_id" value="${escapeAttribute(defaults.duplicated_from_request_id ?? "")}">

                  <div class="inline-divider">
                    <div>
                      <h3>UTM values</h3>
                      <div class="meta">Advanced tracking settings</div>
                      <div class="status-note">These fields are part of the normal flow now. Known standardized values are marked, and free-text override still stays visible as a new value.</div>
                    </div>
                    <div class="pill" id="advanced-summary">No manual tracking changes are active.</div>
                  </div>

                  <div class="summary-banner" id="client-guidance" style="display:none"><div class="summary-text" id="client-guidance-copy"></div></div>

                  <div class="advanced-grid">
                    ${renderCombobox("campaign", "Campaign", "Strategic bucket", "collateral", defaults.utm_campaign)}
                    ${renderCombobox("source", "Source", "Specific asset", "cic_rack_card", defaults.utm_source)}
                    ${renderCombobox("medium", "Medium", "Access method", "qr_code", defaults.utm_medium)}
                    ${renderCombobox("term", "Term", "Optional qualifier", "fall_open_house", defaults.utm_term)}
                    ${renderCombobox("content", "Content", "Optional creative detail", "front_panel", defaults.utm_content, true)}
                  </div>

                  <div class="actions">
                    <button class="btn btn-primary" type="submit" data-submit>${isDuplicate ? "Create Duplicate" : mode === "edit" ? "Save Changes" : "Create Link"}</button>
                    <button class="btn" type="reset">${mode === "edit" ? "Reset Changes" : "Clear"}</button>
                    ${mode === "edit" ? '<a class="btn btn-ghost" href="/utms">Back to library</a>' : ""}
                    <div class="status" id="form-status" aria-live="polite"></div>
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
                <div class="context-block">
                  <h3>Consistency warnings</h3>
                  <div class="helper-copy" id="warning-empty">Checks compare your values and their combination with this client’s history. New or unfamiliar choices require one confirmation.</div>
                  <div class="warning-list" id="warning-list"></div>
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
  <script>${renderClientScript(view.clients)}</script>
</body>
</html>`;
}

function renderGuideCard(field) {
  return `<div class="guide-card"><strong>${escapeHtml(field.label)}</strong><span>${escapeHtml(field.meaning)}. Example: <code>${escapeHtml(field.example)}</code></span></div>`;
}

function renderCombobox(field, label, description, example, value = "", full = false) {
  return `<div class="combo-card${full ? " full" : ""}">
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
    .builder-flow{display:flex;flex-direction:column;gap:16px}.eyebrow{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius-sm);background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}.guide-grid{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}.guide-card{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.guide-card strong{display:block;margin-bottom:4px;font-size:12.5px}.guide-card span{display:block;color:var(--text-2);font-size:12px;line-height:1.45}.guide-card code{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--accent)}.builder-layout{display:grid;gap:20px;grid-template-columns:minmax(0,1fr) 340px;align-items:start}.form-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.full{grid-column:1/-1}.field span{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em}.checkbox-row{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text);font-size:13px}.checkbox-row input{width:auto;margin-top:2px;accent-color:var(--accent)}.inline-divider{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;padding-top:14px;margin:16px 0 12px;border-top:1px solid var(--border)}.inline-divider h3{font-size:14px;margin:0}.status-note,.helper-copy,.empty{color:var(--text-2);line-height:1.5;font-size:12.5px}.advanced-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}.combo-card{position:relative;display:grid;gap:7px;padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2)}.combo-card.full{grid-column:1/-1}.combo-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.combo-head strong{font-size:13px}.combo-subtitle{font-size:12px;color:var(--text-2);line-height:1.4}.combo-subtitle code{font-family:"IBM Plex Mono",monospace;font-size:11.5px}.combo-input{padding-right:40px}.known-state{font-size:11.5px;color:var(--text-3);white-space:nowrap}.known-state.known{color:var(--pos)}.known-state.new{color:var(--warn)}.suggestions{position:absolute;top:calc(100% - 4px);left:12px;right:12px;display:none;z-index:40;padding:6px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-lg);max-height:272px;overflow:auto}.suggestions.visible{display:grid;gap:4px}.suggestion-button{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;width:100%;padding:9px 10px;border:0;border-radius:var(--radius-sm);background:var(--surface-2);cursor:pointer;text-align:left;color:var(--text);font:inherit}.suggestion-button:hover,.suggestion-button:focus-visible{background:var(--accent-soft);outline:none}.suggestion-main{display:grid;gap:2px}.suggestion-help{font-size:11.5px;color:var(--text-3);line-height:1.4}.pill{display:inline-flex;align-items:center;min-height:24px;padding:2px 8px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface-2);font-size:11.5px;color:var(--text-2);white-space:nowrap}.pill.warning{background:var(--warn-soft);border-color:transparent;color:var(--warn)}.pill.success{background:var(--pos-soft);border-color:transparent;color:var(--pos)}.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px}.mini-button,.ghost-button{height:28px;padding:0 9px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font:inherit;font-size:12px;font-weight:500;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.mini-button:hover,.ghost-button:hover{background:var(--surface-2)}.status{min-height:20px;font-size:12.5px;color:var(--text-2)}.status.error{color:var(--neg)}.status.success{color:var(--pos)}.status.warning{color:var(--warn)}.context-card{position:sticky;top:76px}.context-card,.context-card .card-body,.context-stack,.context-block,.preview-grid,.context-list{min-width:0;max-width:100%}.context-stack{display:grid;gap:10px}.context-block{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);overflow:hidden}.context-block h3{font-size:12.5px;margin:0 0 4px}.context-list{display:grid;gap:6px;margin-top:8px}.history-item,.preview-row,.count-row{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;align-items:start}.history-item{grid-template-columns:minmax(0,1fr) auto;padding:8px 10px;border:1px dashed var(--border-strong);border-radius:var(--radius-sm);background:var(--surface)}.preview-grid{display:grid;gap:7px;margin-top:8px}.preview-row strong,.count-row strong{font-size:12px}.preview-row span,.count-row span,.history-item div,.link-value,.utm-value{display:block;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:break-word;text-align:left}.warning-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;min-width:0}.context-block .pill,.warning-list .pill{max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:break-word}.result-shell{display:none}.result-shell.visible{display:block}.result-links,.utm-grid{display:grid;gap:10px}.utm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.link-item,.utm-item{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.link-label,.utm-item strong{display:block;margin-bottom:4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}.link-value,.utm-value{display:block;line-height:1.5;word-break:break-word;color:var(--text);font-family:"IBM Plex Mono",monospace;font-size:12.5px}.link-value{color:var(--accent);text-decoration:none}.link-value:hover{text-decoration:underline}
    @media (max-width:1200px){.builder-layout{grid-template-columns:1fr}.context-card{position:static}.guide-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media (max-width:860px){.advanced-grid,.guide-grid,.utm-grid,.form-grid{grid-template-columns:1fr}}
  `;
}

function renderClientScript(clients = []) {
  return `(function(){
    const UTM_FIELDS=${JSON.stringify(UTM_FIELDS)};
    const DEFAULT_FIELD_GUIDANCE=${serializeJson(Object.fromEntries(FIELD_GUIDANCE.map((field)=>[field.key,{label:field.label,help:field.meaning,placeholder:field.example}])))};
    const CLIENT_GUIDANCE=${serializeJson(Object.fromEntries(clients.map((client)=>[client.key,client.guidance||{}])))};
    const form=document.getElementById("builder-form");
    const resultShell=document.getElementById("result-shell");
    const status=document.getElementById("form-status");
    const clientSelect=document.getElementById("client");
    const destinationInput=document.getElementById("destination_url");
    const qrInput=document.getElementById("needs_qr");
    const originalRequestInput=document.getElementById("original_request_id");
    const duplicatedFromInput=document.getElementById("duplicated_from_request_id");
    const campaignLabelInput=document.getElementById("campaign_label");
    const channelSummary=document.getElementById("channel-summary");
    const advancedSummary=document.getElementById("advanced-summary");
    const clientGuidance=document.getElementById("client-guidance");
    const clientGuidanceCopy=document.getElementById("client-guidance-copy");
    const knownStateNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById(field+"-known-state")]));
    const inputNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById("utm_"+field)]));
    const listNodes=Object.fromEntries(UTM_FIELDS.map((field)=>[field,document.getElementById(field+"-suggestions")]));
    const suggestionState=Object.fromEntries(UTM_FIELDS.map((field)=>[field,[]]));
    const state={requestNonce:0,pendingConsistencyFingerprint:null,confirmedConsistencyFingerprint:null,pendingConsistencyWarnings:[]};

    function queryString(values){const params=new URLSearchParams();Object.entries(values||{}).forEach(([key,value])=>{if(value===null||value===undefined||value===""){return}params.set(key,String(value))});return params.toString()}
    async function fetchJson(url,options){const response=await fetch(url,options);const body=await response.json();if(!response.ok||body.status!=="ok"){const error=new Error(body&&body.error&&body.error.message?body.error.message:"Request failed.");error.code=body&&body.error?body.error.code:null;error.existing=body&&body.error?body.error.existing:null;error.consistencyWarnings=body&&body.error?body.error.consistency_warnings||[]:[];error.consistencyFingerprint=body&&body.error?body.error.consistency_warning_fingerprint:null;throw error}return body}
    function showStatus(message,level){status.textContent=message||"";status.className="status"+(level?" "+level:"")}
    function showSubmitError(error,fallback){if(error&&error.code==="duplicate_utm"&&error.existing){status.className="status error";status.innerHTML=escapeHtml(error.message)+' <a class="link" href="'+escapeAttribute(error.existing.library_url||"/utms")+'">Open existing link</a>';return}if(error&&error.code==="consistency_confirmation_required"){state.pendingConsistencyFingerprint=error.consistencyFingerprint;state.pendingConsistencyWarnings=error.consistencyWarnings||[];renderConsistencyWarnings(state.pendingConsistencyWarnings,true);showStatus("Review the consistency warnings, then correct the values or create anyway.","warning");document.getElementById("warning-list").scrollIntoView({behavior:"smooth",block:"center"});return}showStatus(error&&error.message?error.message:fallback,"error")}
    function clearStatus(){showStatus("","")}
    function currentSelection(){return{client:clientSelect.value||"",campaign:inputNodes.campaign.value.trim(),source:inputNodes.source.value.trim(),medium:inputNodes.medium.value.trim(),term:inputNodes.term.value.trim(),content:inputNodes.content.value.trim()}}
    function payloadForPreview(){const payload={client:clientSelect.value,destination_url:destinationInput.value.trim(),needs_qr:qrInput.checked};UTM_FIELDS.forEach((field)=>{const value=inputNodes[field].value.trim();if(value){payload["utm_"+field]=value}});return payload}
    function payloadForSubmit(){const payload=payloadForPreview();if(originalRequestInput&&originalRequestInput.value.trim()){payload.original_request_id=originalRequestInput.value.trim()}if(duplicatedFromInput&&duplicatedFromInput.value.trim()){payload.duplicated_from_request_id=duplicatedFromInput.value.trim()}if(campaignLabelInput&&campaignLabelInput.value.trim()){payload.campaign_label=campaignLabelInput.value.trim()}if(state.confirmedConsistencyFingerprint){payload.consistency_warning_fingerprint=state.confirmedConsistencyFingerprint}return payload}
    function updateChannelSummary(){const medium=inputNodes.medium.value.trim().toLowerCase();const source=inputNodes.source.value.trim().toLowerCase();if(medium==="qr_code"||medium==="offline"){channelSummary.textContent="Channel will resolve as QR from the selected medium.";return}if(medium==="website"||medium==="domain"||medium==="email"||medium==="pr"){channelSummary.textContent="Channel will resolve from the selected medium.";return}if(source==="facebook"||source==="instagram"||source==="linked_in"||source==="linkedin"){channelSummary.textContent="Channel will resolve from the selected source.";return}channelSummary.textContent="Channel will resolve from your UTM values."}
    function updateAdvancedSummary(){const activeFields=UTM_FIELDS.filter((field)=>inputNodes[field].value.trim());advancedSummary.textContent=activeFields.length?"Manual values active for: "+activeFields.join(", "):"No manual tracking changes are active."}
    function updateClientGuidance(){const guidance=CLIENT_GUIDANCE[clientSelect.value]||{};const fields=guidance.fields||{};UTM_FIELDS.forEach((field)=>{const defaults=DEFAULT_FIELD_GUIDANCE[field];const details=fields[field]||{};document.getElementById(field+"-label").textContent=details.label||defaults.label;document.getElementById(field+"-guidance").innerHTML=escapeHtml(details.help||defaults.help)+'. Example: <code>'+escapeHtml(details.placeholder||defaults.placeholder)+'</code>';inputNodes[field].placeholder=details.placeholder||defaults.placeholder});clientGuidanceCopy.textContent=guidance.summary||"";clientGuidance.style.display=guidance.summary?"":"none"}
    function renderKnownState(field){const value=inputNodes[field].value.trim().toLowerCase();const suggestions=suggestionState[field]||[];const exact=suggestions.find((item)=>item.value===value);const node=knownStateNodes[field];if(!value){node.textContent="No override entered.";node.className="known-state";return}if(exact&&exact.known){node.textContent="Known standardized value.";node.className="known-state known";return}node.textContent="Free-text new value.";node.className="known-state new"}
    function closeSuggestions(field){listNodes[field].classList.remove("visible")}
    function closeAllSuggestions(){UTM_FIELDS.forEach(closeSuggestions)}
    function renderSuggestions(field,items,typedValue){suggestionState[field]=items||[];renderKnownState(field);const list=listNodes[field];const typed=String(typedValue||"").trim().toLowerCase();const exactKnown=(items||[]).some((item)=>item.value===typed);const rows=[];if(typed&&!exactKnown){rows.push('<button type="button" class="suggestion-button" data-field="'+escapeAttribute(field)+'" data-value="'+escapeAttribute(typed)+'"><span class="suggestion-main"><strong>Use new value</strong><span class="suggestion-help">'+escapeHtml(typed)+'</span></span><span class="pill warning">New</span></button>')}(items||[]).forEach((item)=>{const badge=item.recommended?'Recommended':(item.known?'Known':'New');const badgeClass=item.recommended?'success':(item.known?'success':'warning');rows.push('<button type="button" class="suggestion-button" data-field="'+escapeAttribute(field)+'" data-value="'+escapeAttribute(item.value)+'"><span class="suggestion-main"><strong>'+escapeHtml(item.value+" ("+String(item.count||0)+")")+'</strong>'+(item.relation?'<span class="suggestion-help">'+escapeHtml(item.relation)+'</span>':"")+'</span><span class="pill '+badgeClass+'">'+badge+'</span></button>')});if(!rows.length){list.innerHTML="";list.classList.remove("visible");return}list.innerHTML=rows.join("");list.classList.add("visible")}
    async function loadSuggestions(field,query,showList){if(!clientSelect.value){if(showList){renderSuggestions(field,[],query)}return}const selection=currentSelection();const body=await fetchJson("/new/utm-intelligence/suggestions.json?"+queryString({field,client:selection.client,campaign:selection.campaign,source:selection.source,medium:selection.medium,term:selection.term,content:selection.content,query}));if(showList){renderSuggestions(field,body.items||[],query)}else{suggestionState[field]=body.items||[];renderKnownState(field)}}
    function renderPreview(preview){const grid=document.getElementById("preview-grid");const empty=document.getElementById("preview-empty");if(!preview||!preview.resolved){grid.innerHTML="";empty.style.display="";return}empty.style.display="none";const resolved=preview.resolved;grid.innerHTML=[["Campaign",resolved.utm_campaign],["Source",resolved.utm_source],["Medium",resolved.utm_medium],["Term",resolved.utm_term||"(empty)"],["Content",resolved.utm_content||"(empty)"],["Tracked URL",resolved.final_long_url]].map((entry)=>'<div class="preview-row"><strong>'+escapeHtml(entry[0])+'</strong><span>'+escapeHtml(entry[1]||"--")+'</span></div>').join("")}
    function renderCounts(context){const list=document.getElementById("count-list");const empty=document.getElementById("count-empty");const fields=context&&context.counts&&context.counts.fields?context.counts.fields:{};const rows=Object.entries(fields).map(([field,details])=>'<div class="count-row"><strong>'+escapeHtml(field)+'</strong><span>'+escapeHtml(String(details.count||0))+' scoped / '+escapeHtml(String(details.global_count||0))+' overall</span></div>');list.innerHTML=rows.join("");empty.style.display=rows.length?"none":"";const comboCopy=document.getElementById("combo-copy");if(context&&context.combination){const summary=context.combination.campaign_summary;comboCopy.textContent=summary?'Exact matches: '+String(context.combination.exact_match_count||0)+'. Campaign "'+summary.campaign+'" has '+String(summary.total_rows||0)+' rows across '+String(summary.unique_sources||0)+' sources and '+String(summary.unique_mediums||0)+' mediums.':'Exact matches: '+String(context.combination.exact_match_count||0)+'.'}}
    function renderHistoryList(targetId,emptyId,items){const list=document.getElementById(targetId);const empty=document.getElementById(emptyId);const rows=(items||[]).map((item)=>{const meta=[item.client?("Client: "+item.client):"",item.term?("Term: "+item.term):"",item.content?("Content: "+item.content):"",item.bitly?("Short link: "+item.bitly):""].filter(Boolean).join(" • ");return '<div class="history-item"><div><strong>'+escapeHtml(item.campaign+" / "+item.source+" / "+item.medium)+'</strong>'+(meta?'<div class="suggestion-help">'+escapeHtml(meta)+'</div>':"")+'<div class="suggestion-help">'+escapeHtml(item.destination_url||"")+'</div></div><span class="pill">'+escapeHtml(item.creation_date||"undated")+'</span></div>'});list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function renderRecommendations(context){const list=document.getElementById("recommend-list");const empty=document.getElementById("recommend-empty");const recommendations=context&&context.recommendations?context.recommendations:{};const rows=Object.entries(recommendations).filter(([,item])=>item&&item.value).map(([field,item])=>'<span class="pill success">'+escapeHtml(field+": "+item.value+" ("+String(item.count||0)+")")+'</span>');list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function renderLoadedSuggestions(){const list=document.getElementById("recommend-list");const empty=document.getElementById("recommend-empty");const rows=[];UTM_FIELDS.forEach((field)=>{(suggestionState[field]||[]).slice(0,3).forEach((item)=>rows.push('<button type="button" class="pill success" data-field="'+escapeAttribute(field)+'" data-value="'+escapeAttribute(item.value)+'">'+escapeHtml(field+": "+item.value+" ("+String(item.count||0)+")")+'</button>'))});list.innerHTML=rows.join("");empty.textContent=clientSelect.value?"No historical standards were found for this client.":"Recommendations appear as you make selections.";empty.style.display=rows.length?"none":""}
    async function loadClientHistory(){if(!clientSelect.value){renderHistoryList("history-list","history-empty",[]);return}const body=await fetchJson("/new/utm-intelligence/history.json?"+queryString({client:clientSelect.value,limit:6}));renderHistoryList("history-list","history-empty",body.items||[])}
    function renderRelated(context){const list=document.getElementById("related-list");const empty=document.getElementById("related-empty");const termItems=context&&context.related_examples&&context.related_examples.term?context.related_examples.term:[];const contentItems=context&&context.related_examples&&context.related_examples.content?context.related_examples.content:[];const rows=[].concat(termItems.map((item)=>'<span class="pill">term: '+escapeHtml(item.value)+' ('+escapeHtml(String(item.count||0))+')</span>')).concat(contentItems.map((item)=>'<span class="pill">content: '+escapeHtml(item.value)+' ('+escapeHtml(String(item.count||0))+')</span>'));list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function renderConsistencyWarnings(warnings,showActions){const list=document.getElementById("warning-list");const empty=document.getElementById("warning-empty");const rows=(warnings||[]).map((warning)=>{const label=String(warning.type||"warning").replace(/_/g," ");const recommendations=(warning.recommendations||[]).map((item)=>'<button type="button" class="pill success" data-field="'+escapeAttribute(item.field)+'" data-value="'+escapeAttribute(item.value)+'">Use '+escapeHtml(item.value)+' ('+escapeHtml(String(item.usage_count||0))+')</button>').join("");return '<div class="alert-row '+(warning.severity==="info"?'ok':'warn')+'"><div><div class="title">'+escapeHtml(label)+'</div><div class="body">'+escapeHtml(warning.message)+'</div>'+(recommendations?'<div class="warning-list">'+recommendations+'</div>':"")+'</div></div>'});if(showActions){rows.push('<div class="actions"><button type="button" class="mini-button" data-review-consistency>Review Values</button><button type="button" class="button" data-confirm-consistency>Create Anyway</button></div>')}list.innerHTML=rows.join("");empty.style.display=rows.length?"none":""}
    function renderWarnings(preview,context){const consistency=context&&context.consistency?context.consistency:(preview&&preview.context?preview.context.consistency:null);const structured=consistency&&consistency.warnings?consistency.warnings:[];const legacy=[].concat((preview&&preview.resolved&&preview.resolved.warnings)||[]);const messages=new Set(structured.map((item)=>item.message));const combined=structured.concat(legacy.filter((message)=>message&&!messages.has(message)).map((message)=>({type:"guidance",severity:"warning",message,recommendations:[]})));renderConsistencyWarnings(combined,false)}
    async function refreshContextAndPreview(){const payload=payloadForPreview();if(!payload.client){renderPreview(null);renderCounts(null);renderRecommendations(null);renderHistoryList("history-list","history-empty",[]);renderHistoryList("last-year-list","last-year-empty",[]);renderRelated(null);renderWarnings(null,null);clearStatus();return}const nonce=++state.requestNonce;try{const contextPromise=fetchJson("/new/utm-intelligence/context.json?"+queryString(payload));const previewPromise=payload.destination_url?fetchJson("/new/preview.json",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}):Promise.resolve({preview:null});const [previewBody,contextBody]=await Promise.all([previewPromise,contextPromise]);if(nonce!==state.requestNonce){return}renderPreview(previewBody.preview);renderCounts(contextBody);renderRecommendations(contextBody);renderHistoryList("history-list","history-empty",contextBody.similar_history?contextBody.similar_history.items:[]);renderHistoryList("last-year-list","last-year-empty",contextBody.last_year?contextBody.last_year.items:[]);renderRelated(contextBody);renderWarnings(previewBody.preview,contextBody);updateChannelSummary();clearStatus()}catch(error){if(nonce!==state.requestNonce){return}renderPreview(null);clearStatus()}}
    const debouncedRefresh=debounce(refreshContextAndPreview,220);

    document.addEventListener("click",async(event)=>{const confirmButton=event.target.closest("[data-confirm-consistency]");if(confirmButton){event.preventDefault();state.confirmedConsistencyFingerprint=state.pendingConsistencyFingerprint;form.requestSubmit();return}const reviewButton=event.target.closest("[data-review-consistency]");if(reviewButton){event.preventDefault();const field=state.pendingConsistencyWarnings.flatMap((item)=>item.fields||[])[0];if(field&&inputNodes[field]){inputNodes[field].focus()}return}const suggestion=event.target.closest("[data-field][data-value]");if(suggestion){event.preventDefault();const field=suggestion.getAttribute("data-field");inputNodes[field].value=suggestion.getAttribute("data-value")||"";state.confirmedConsistencyFingerprint=null;state.pendingConsistencyFingerprint=null;closeSuggestions(field);updateAdvancedSummary();await loadSuggestions(field,inputNodes[field].value.trim(),false);if(field==="campaign"){await Promise.all([loadSuggestions("source",inputNodes.source.value.trim(),false),loadSuggestions("medium",inputNodes.medium.value.trim(),false),loadSuggestions("term",inputNodes.term.value.trim(),false),loadSuggestions("content",inputNodes.content.value.trim(),false)])}debouncedRefresh();return}const copyButton=event.target.closest("[data-copy]");if(copyButton){event.preventDefault();try{await navigator.clipboard.writeText(copyButton.getAttribute("data-copy")||"");showStatus("Copied to clipboard.","success")}catch{showStatus("Copy failed.","error")}return}if(!event.target.closest(".combo-card")){closeAllSuggestions()}});
    clientSelect.addEventListener("change",()=>{state.confirmedConsistencyFingerprint=null;state.pendingConsistencyFingerprint=null;updateChannelSummary();updateClientGuidance();Promise.all(UTM_FIELDS.map((field)=>loadSuggestions(field,inputNodes[field].value.trim(),false))).then(()=>{renderLoadedSuggestions();return loadClientHistory()}).then(()=>{if(clientSelect.value){inputNodes.campaign.focus();return loadSuggestions("campaign",inputNodes.campaign.value.trim(),true)}}).then(()=>debouncedRefresh()).catch((error)=>showStatus(error.message,"error"))});
    destinationInput.addEventListener("input",debouncedRefresh);
    qrInput.addEventListener("change",debouncedRefresh);
    UTM_FIELDS.forEach((field)=>{inputNodes[field].addEventListener("focus",()=>{loadSuggestions(field,inputNodes[field].value.trim(),true).catch(()=>{})});inputNodes[field].addEventListener("input",async()=>{state.confirmedConsistencyFingerprint=null;state.pendingConsistencyFingerprint=null;updateAdvancedSummary();updateChannelSummary();await loadSuggestions(field,inputNodes[field].value.trim(),true);if(field==="campaign"){await Promise.all([loadSuggestions("source",inputNodes.source.value.trim(),false),loadSuggestions("medium",inputNodes.medium.value.trim(),false),loadSuggestions("term",inputNodes.term.value.trim(),false),loadSuggestions("content",inputNodes.content.value.trim(),false)])}debouncedRefresh()})});
    form.addEventListener("reset",()=>{window.setTimeout(()=>{closeAllSuggestions();showStatus("","");resultShell.classList.remove("visible");updateChannelSummary();updateAdvancedSummary();updateClientGuidance();UTM_FIELDS.forEach((field)=>renderSuggestions(field,[],""));refreshContextAndPreview().catch(()=>{})},0)});
    form.addEventListener("submit",async(event)=>{event.preventDefault();if(!form.reportValidity()){return}const submitButton=form.querySelector("[data-submit]");const payload=payloadForSubmit();const editing=Boolean(payload.original_request_id);showStatus(editing?"Saving changes...":"Creating link...","");submitButton.disabled=true;try{const body=await fetchJson("/new",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});renderResult(body.result);showStatus(body.result.status==="completed_without_short_link"?(body.result.short_link_warning||"Tracked link saved without a short link."):(editing?"Changes saved.":"Link created."),body.result.status==="completed_without_short_link"?"warning":"success")}catch(error){showSubmitError(error,editing?"Unable to save changes right now.":"Unable to create the link right now.")}finally{submitButton.disabled=false}});
    function renderResult(payload){document.getElementById("result-title").textContent=payload.message;document.getElementById("result-subtitle").textContent=payload.client_display_name+" | "+payload.channel_display_name;document.getElementById("result-links").innerHTML=[renderLinkItem("Tracked link",payload.tracked_url,"Tracked link not available."),renderLinkItem("Short link",payload.short_url,"Short link not available for this link."),renderLinkItem("QR code",payload.qr_url,"QR code not requested for this link.")].join("");document.getElementById("result-utm-grid").innerHTML=[["Source",payload.utm_source],["Medium",payload.utm_medium],["Campaign",payload.utm_campaign],["Term",payload.utm_term===""?"(empty)":payload.utm_term],["Content",payload.utm_content===""?"(empty)":payload.utm_content]].map((entry)=>'<div class="utm-item"><strong>'+escapeHtml(entry[0])+'</strong><div class="utm-value">'+escapeHtml(entry[1]||"--")+'</div></div>').join("");document.getElementById("result-actions").innerHTML=[payload.tracked_url?'<button type="button" class="mini-button" data-copy="'+escapeAttribute(payload.tracked_url)+'">Copy tracked link</button>':"",payload.short_url?'<button type="button" class="mini-button" data-copy="'+escapeAttribute(payload.short_url)+'">Copy short link</button>':"",payload.qr_url?'<button type="button" class="mini-button" data-copy="'+escapeAttribute(payload.qr_url)+'">Copy QR link</button>':"",payload.library_url?'<a class="ghost-button" href="'+escapeAttribute(payload.library_url)+'">Open in library</a>':""].join("");document.getElementById("result-warnings").innerHTML=(payload.warnings||[]).map((warning)=>'<span class="pill warning">'+escapeHtml(warning)+'</span>').join("");resultShell.classList.add("visible");resultShell.scrollIntoView({behavior:"smooth",block:"start"})}
    function renderLinkItem(label,value,emptyMessage){if(!value){return '<div class="link-item"><div class="link-label">'+escapeHtml(label)+'</div><div class="empty">'+escapeHtml(emptyMessage)+'</div></div>'}return '<div class="link-item"><div class="link-label">'+escapeHtml(label)+'</div><a class="link-value" href="'+escapeAttribute(value)+'" target="_blank" rel="noreferrer">'+escapeHtml(value)+'</a></div>'}
    function debounce(fn,waitMs){let timer=null;return function(){clearTimeout(timer);timer=window.setTimeout(()=>fn.apply(null,arguments),waitMs)}}
    function escapeHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
    function escapeAttribute(value){return escapeHtml(value)}
    updateChannelSummary();updateAdvancedSummary();updateClientGuidance();UTM_FIELDS.forEach((field)=>renderSuggestions(field,[],""));refreshContextAndPreview().catch(()=>{})
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
