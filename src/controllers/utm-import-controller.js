import { NodeResponse } from "../http/response.js";
import { BRAND_HEAD_HTML, renderIcon, renderJustFlowShellStyles, renderJustFlowSidebar, renderJustFlowThemeScript, renderJustFlowTopbar } from "./app-shell.js";

export class UtmImportController {
  constructor({ utmCsvImportService }) {
    this.utmCsvImportService = utmCsvImportService;
  }

  handleHtml(request) {
    return NodeResponse.text(renderHtml(request?.user ?? null), 200, { "Content-Type": "text/html; charset=utf-8" });
  }

  async handleImport(request) {
    const result = await this.utmCsvImportService.import(request.rawBody, request.user);
    if (!result.ok) {
      return NodeResponse.json({ status: "error", error: { code: result.code, message: result.message } }, 422);
    }
    return NodeResponse.json({ status: "ok", summary: result.summary });
  }
}

function renderHtml(user) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BRAND_HEAD_HTML}<title>Import UTM CSV</title><style>${renderJustFlowShellStyles()}</style></head>
  <body>${renderJustFlowThemeScript()}<div class="app">${renderJustFlowSidebar("imports", { standaloneUtm: true, user })}<main class="main">${renderJustFlowTopbar({ section: "UTM Builder", title: "Import CSV", showSearch: false })}<div class="page">
    <div class="page-header"><div class="page-title-block"><h1>Import UTM library</h1><p class="subtitle">Upload a UTM Library CSV export. Existing matching links are skipped automatically.</p></div><div class="page-actions"><a class="btn" href="/utms">${renderIcon("link")} Link Library</a></div></div>
    <section class="card"><div class="card-header"><div><h3>Select CSV file</h3><div class="meta">The importer preserves destination, tracked, short, and QR URLs.</div></div></div><div class="card-body">
      <form id="import-form"><label class="field"><span>UTM library CSV</span><input id="csv-file" type="file" accept=".csv,text/csv" required></label><div style="display:flex;gap:10px;align-items:center;margin-top:16px"><button class="btn btn-primary" type="submit">Import CSV</button><span id="status" aria-live="polite"></span></div></form>
      <div id="result" style="margin-top:18px"></div>
    </div></section>
  </div></main></div><script>
  const form=document.getElementById("import-form"),fileInput=document.getElementById("csv-file"),status=document.getElementById("status"),result=document.getElementById("result");
  form.addEventListener("submit",async(event)=>{event.preventDefault();const file=fileInput.files[0];if(!file)return;const button=form.querySelector("button");button.disabled=true;status.textContent="Importing "+file.name+"...";result.innerHTML="";try{const response=await fetch("/imports",{method:"POST",headers:{"Content-Type":"text/csv; charset=utf-8"},body:await file.text()});const body=await response.json();if(!response.ok||body.status!=="ok")throw new Error(body?.error?.message||"Import failed.");const s=body.summary;status.textContent="Import complete.";result.innerHTML='<div class="summary-banner"><div class="summary-text"><b>'+s.imported+'</b> imported &nbsp; <b>'+s.skipped+'</b> skipped &nbsp; <b>'+s.failed+'</b> failed out of '+s.total+' rows.</div><div class="right"><a class="btn btn-primary" href="/utms">View Link Library</a></div></div>'+(s.errors.length?'<div class="alert-row warn"><div><div class="title">Rows requiring attention</div><div class="body">'+s.errors.map(e=>'Row '+e.row+': '+escapeHtml(e.message)).join('<br>')+'</div></div></div>':"");}catch(error){status.textContent="";result.innerHTML='<div class="alert-row warn"><div><div class="title">Import failed</div><div class="body">'+escapeHtml(error.message)+'</div></div></div>';}finally{button.disabled=false;}});
  function escapeHtml(value){return String(value||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  </script></body></html>`;
}
