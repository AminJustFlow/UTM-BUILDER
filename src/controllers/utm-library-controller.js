import { NodeResponse } from "../http/response.js";
import { friendlyActorName } from "../services/utm-library-service.js";
import { parseFormBody } from "./auth-page.js";
import { BRAND_HEAD_HTML, renderIcon, renderJustFlowShellStyles, renderJustFlowSidebar, renderJustFlowThemeScript, renderJustFlowTopbar, renderLoadingStyles } from "./app-shell.js";

const GOVERNANCE_FIELDS = ["campaign", "source", "medium", "term", "content", "pair", "combination"];
const LEGACY_GOVERNANCE_DISPLAY_VALUES = new Map([
  ["gas|caregiver", "Caregiver"],
  ["gas|follow", "Follow"],
  ["gas|massachusetts", "Massachusetts"]
]);

function acknowledgementKey(field, value) {
  return `${String(field ?? "").trim().toLowerCase()}:${String(value ?? "").trim().toLowerCase()}`;
}

const AUDIT_ACTION_LABELS = {
  created: "Created",
  regenerated: "Updated",
  duplicated: "Duplicated",
  imported: "Imported",
  supplemented: "Generated missing asset",
  archived: "Archived",
  restored: "Restored",
  consistency_override: "Consistency override"
};

const SORT_LABELS = {
  recent: "Newest first",
  oldest: "Oldest first",
  client: "Client A-Z",
  campaign: "Campaign name A-Z",
  requests: "Most requests first"
};

const TOGGLE_LABELS = {
  all: "All",
  with_qr: "With QR",
  without_qr: "Without QR",
  with_short_link: "With short link",
  without_short_link: "No short link"
};

export class UtmLibraryController {
  constructor({
    utmLibraryService,
    utmLibraryEditorService,
    rulesService,
    utmIntelligenceService = null,
    linkAuditRepository = null,
    utmValueAcknowledgementRepository = null,
    standalone = false
  }) {
    this.utmLibraryService = utmLibraryService;
    this.utmLibraryEditorService = utmLibraryEditorService;
    this.rulesService = rulesService;
    this.utmIntelligenceService = utmIntelligenceService;
    this.linkAuditRepository = linkAuditRepository;
    this.utmValueAcknowledgementRepository = utmValueAcknowledgementRepository;
    this.standalone = standalone;
  }

  async handleHtml(request) {
    await this.utmIntelligenceService?.refreshDataAsync?.();
    const library = await (this.utmLibraryService.listCachedAsync?.(request.query)
      ?? this.utmLibraryService.listCached?.(request.query)
      ?? this.utmLibraryService.listAsync?.(request.query)
      ?? this.utmLibraryService.list(request.query));
    this.applyClientDisplayNames(library);
    const acknowledgedSet = await this.loadAcknowledgedSet();
    const view = {
      library,
      toast: normalizeTextValue(request.query.toast),
      toastLevel: normalizeToastLevel(request.query.toast_level),
      highlightRequestId: positiveInteger(request.query.highlight_request_id, null),
      standalone: this.standalone,
      user: request?.user ?? null,
      canManageGovernance: request?.user?.role === "admin",
      governance: summarizeGovernance(library.items, this.utmIntelligenceService, acknowledgedSet)
    };

    return NodeResponse.text(renderHtml(view), 200, {
      "Content-Type": "text/html; charset=utf-8"
    });
  }

  async handleJson(request) {
    await this.utmIntelligenceService?.refreshDataAsync?.();
    const library = await (this.utmLibraryService.listAsync?.(request.query)
      ?? this.utmLibraryService.list(request.query));
    this.applyClientDisplayNames(library);
    return NodeResponse.json(library);
  }

  async handleCsv(request) {
    const library = await (this.utmLibraryService.listAsync?.({
      ...request.query,
      page: 1,
      per_page: 10000
    }) ?? this.utmLibraryService.list({
      ...request.query,
      page: 1,
      per_page: 10000
    }));
    this.applyClientDisplayNames(library);

    return NodeResponse.text(renderCsv(library.items), 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"utm-library.csv\""
    });
  }

  async handleHistory(request) {
    const fingerprint = normalizeTextValue(request.query.fingerprint);
    if (!fingerprint || !this.linkAuditRepository) {
      return NodeResponse.json({ status: "ok", events: [] });
    }
    const rows = await this.linkAuditRepository.listByFingerprint(fingerprint);
    const events = rows.map((row) => ({
      action: row.action,
      action_label: AUDIT_ACTION_LABELS[row.action] ?? humanize(row.action),
      actor: friendlyActorName(row.actor_user_name),
      summary: row.summary ?? "",
      at: row.created_at,
      at_label: formatDate(row.created_at)
    }));
    return NodeResponse.json({ status: "ok", events });
  }

  applyClientDisplayNames(library) {
    for (const item of library?.items ?? []) {
      if (item.client) item.clientDisplayName = this.rulesService.getClientDisplayName(item.client);
    }
  }

  async loadAcknowledgedSet() {
    if (!this.utmValueAcknowledgementRepository) {
      return new Set();
    }
    const rows = await (this.utmValueAcknowledgementRepository.listAsync?.()
      ?? this.utmValueAcknowledgementRepository.list?.()
      ?? []);
    return new Set(rows.map((row) => acknowledgementKey(row.field, row.value)));
  }

  async handleAcknowledge(request) {
    const form = parseFormBody(request.rawBody);
    const field = normalizeTextValue(form.field).toLowerCase();
    const value = normalizeTextValue(form.value);
    const client = normalizeTextValue(form.client).toLowerCase();
    const warningType = normalizeTextValue(form.warning_type).toLowerCase();

    const validField = GOVERNANCE_FIELDS.includes(field) || /^pair:(campaign\+(source|medium|term|content)|source\+medium)$/u.test(field);
    if (!validField || !value || !client || warningType === "possible_typo") {
      return NodeResponse.redirect(`/utms?${buildQueryString({
        toast: "Could not acknowledge that value.",
        toast_level: "error"
      })}`);
    }

    if (["campaign", "source", "medium", "term", "content"].includes(field) && this.utmIntelligenceService) {
      await this.utmIntelligenceService.refreshDataAsync?.();
      const analysis = this.utmIntelligenceService.consistencyAnalysis({ client, [field]: value });
      if (analysis.warnings.some((warning) => warning.type === "possible_typo")) {
        return NodeResponse.redirect(`/utms?${buildQueryString({
          toast: "Possible typos must be corrected and cannot be acknowledged as standards.",
          toast_level: "error"
        })}`);
      }
    }

    if (this.utmValueAcknowledgementRepository) {
      await (this.utmValueAcknowledgementRepository.acknowledgeAsync?.({
        field: `${client}|${field}`,
        value,
        userId: request?.user?.id ?? null,
        userName: request?.user?.displayName ?? null
      }) ?? this.utmValueAcknowledgementRepository.acknowledge?.({
        field: `${client}|${field}`,
        value,
        userId: request?.user?.id ?? null,
        userName: request?.user?.displayName ?? null
      }));
    }

    return NodeResponse.redirect(`/utms?${buildQueryString({
      toast: `Acknowledged "${value}" for ${client}. It will no longer be flagged for review.`,
      toast_level: "success"
    })}`);
  }

  async handleArchive(request) {
    const parsedBody = request.parseJson();
    if (!parsedBody.ok) {
      return NodeResponse.json({
        status: "error",
        error: {
          code: parsedBody.errorCode,
          message: parsedBody.errorMessage
        }
      }, 400);
    }

    const result = await this.utmLibraryEditorService.archiveEntry(parsedBody.value, request.user);
    if (!result.ok) {
      return NodeResponse.json({
        status: "error",
        error: {
          code: result.code,
          message: result.message
        }
      }, result.statusCode ?? 500);
    }

    return NodeResponse.json({
      status: "ok",
      archived_requests: result.archivedRequests,
      redirect_url: `/utms?${buildQueryString({
        toast: result.archivedRequests > 1
          ? "Saved link and its matching versions archived."
          : "Saved link archived.",
        toast_level: "success"
      })}`
    });
  }

  async handleRestore(request) {
    const parsedBody = request.parseJson();
    if (!parsedBody.ok) return NodeResponse.json({ status: "error", error: { code: parsedBody.errorCode, message: parsedBody.errorMessage } }, 400);
    const result = await this.utmLibraryEditorService.restoreEntry(parsedBody.value, request.user);
    if (!result.ok) return NodeResponse.json({ status: "error", error: { code: result.code, message: result.message } }, result.statusCode ?? 500);
    return NodeResponse.json({ status: "ok", restored_requests: result.restoredRequests,
      redirect_url: `/utms?${buildQueryString({ toast: "Saved link restored.", toast_level: "success" })}` });
  }

  async handleSupplement(request) {
    const parsedBody = request.parseJson();
    if (!parsedBody.ok) {
      return NodeResponse.json({
        status: "error",
        error: {
          code: parsedBody.errorCode,
          message: parsedBody.errorMessage
        }
      }, 400);
    }

    const result = await this.utmLibraryEditorService.supplementAssets(parsedBody.value, request.user);
    if (!result.ok) {
      return NodeResponse.json({
        status: "error",
        error: {
          code: result.code,
          message: result.message
        }
      }, result.statusCode ?? 500);
    }

    const generated = [
      result.generatedShort ? "Short link" : "",
      result.generatedQr ? "QR code" : ""
    ].filter(Boolean);
    const toast = generated.length > 0
      ? `${generated.join(" and ")} generated.`
      : "That asset is already available.";

    return NodeResponse.json({
      status: "ok",
      short_url: result.shortUrl,
      qr_url: result.qrUrl,
      redirect_url: `/utms?${buildQueryString({
        highlight_request_id: result.requestId,
        toast: result.warning || toast,
        toast_level: result.warning ? "warning" : "success"
      })}`
    });
  }

  async handleBulk(request) {
    const parsedBody = request.parseJson();
    if (!parsedBody.ok) {
      return NodeResponse.json({ status: "error", error: { code: parsedBody.errorCode, message: parsedBody.errorMessage } }, 400);
    }
    const action = normalizeTextValue(parsedBody.value.action).toLowerCase();
    const requestIds = [...new Set((Array.isArray(parsedBody.value.request_ids) ? parsedBody.value.request_ids : [])
      .map((value) => positiveInteger(value, null)).filter(Boolean))].slice(0, 100);
    if (!requestIds.length || !["short", "qr", "archive", "restore"].includes(action)) {
      return NodeResponse.json({ status: "error", error: { code: "invalid_bulk_request", message: "Select at least one link and a valid bulk action." } }, 422);
    }
    if (["archive", "restore"].includes(action) && request.user?.role !== "admin") {
      return NodeResponse.json({ status: "error", error: { code: "forbidden", message: "Administrator access is required to archive or restore links." } }, 403);
    }

    const results = [];
    for (const requestId of requestIds) {
      const result = action === "archive"
        ? await this.utmLibraryEditorService.archiveEntry({ request_id: requestId }, request.user)
        : action === "restore"
          ? await this.utmLibraryEditorService.restoreEntry({ request_id: requestId }, request.user)
        : await this.utmLibraryEditorService.supplementAssets({
          request_id: requestId,
          generate_short: action === "short",
          generate_qr: action === "qr",
          qr_project_id: parsedBody.value.qr_project_id
        }, request.user);
      results.push({ request_id: requestId, ok: result.ok, code: result.code ?? null, message: result.message ?? result.warning ?? "" });
    }
    const succeeded = results.filter((result) => result.ok).length;
    return NodeResponse.json({
      status: succeeded ? "ok" : "error",
      action,
      selected: requestIds.length,
      succeeded,
      failed: results.length - succeeded,
      results
    }, succeeded ? 200 : 422);
  }
}

function renderHtml(view) {
  const { library, toast, toastLevel, highlightRequestId, governance, canManageGovernance } = view;
  const queryBase = {
    client: library.filters.client,
    source: library.filters.source,
    medium: library.filters.medium,
    term: library.filters.term,
    content: library.filters.content,
    campaign: library.filters.campaign,
    status: library.filters.status,
    search: library.filters.search,
    qr: library.filters.qr,
    short_link: library.filters.shortLink,
    sort: library.filters.sort,
    per_page: library.filters.perPage
    ,view: library.filters.view
  };
  const csvHref = `/utms.csv?${buildQueryString({ ...queryBase, page: 1 })}`;
  const jsonHref = `/utms.json?${buildQueryString({ ...queryBase, page: library.pagination.page })}`;
  const activeFilterCount = [
    library.filters.search,
    library.filters.client,
    library.filters.source,
    library.filters.medium,
    library.filters.term,
    library.filters.content,
    library.filters.campaign,
    library.filters.status !== "all" ? library.filters.status : "",
    library.filters.qr !== "all" ? library.filters.qr : "",
    library.filters.shortLink !== "all" ? library.filters.shortLink : "",
    library.filters.sort !== "recent" ? library.filters.sort : ""
  ].filter(Boolean).length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${BRAND_HEAD_HTML}
  <title>Link Library</title>
  <style>
    ${renderJustFlowShellStyles()}
    .library-flow{display:flex;flex-direction:column;gap:16px}.library-actions,.actions,.chips,.mini-actions,.page-links{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.meta,.muted,.empty{color:var(--text-2);line-height:1.5}.results-head,.panel-head,.card-head,.pagination{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end}.results-head h2,.panel-head h2,.card-title h3,.section h4{margin:0}.results-head h2,.panel-head h2{font-size:15px;font-weight:600;letter-spacing:-.01em}.card-title h3{font-size:18px;font-weight:600;letter-spacing:-.02em}.badge,.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-2);font-size:12px;font-weight:500}.chip{background:var(--accent-soft);color:var(--accent);border-color:transparent}.chip.neutral{background:var(--surface-2);color:var(--text-2);border-color:var(--border)}.chip.warning{background:var(--warn-soft);color:var(--warn);border-color:transparent}.chip.error{background:var(--neg-soft);color:var(--neg);border-color:transparent}.library-kpis{margin-bottom:0}.library-filters{grid-template-columns:minmax(180px,1.4fr) repeat(4,minmax(120px,1fr)) auto auto}.library-filters .advanced-fields{grid-column:1/-1;display:grid;grid-template-columns:repeat(7,minmax(110px,1fr));gap:10px}.button,.link-button,.mini-button,.subtle-link,.page-link,.danger-button{height:32px;padding:0 12px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font:inherit;font-weight:500;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .12s;white-space:nowrap}.button{background:var(--accent);border-color:var(--accent);color:#fff}.button:hover,.link-button:hover,.mini-button:hover,.subtle-link:hover,.page-link:hover,.danger-button:hover{background:var(--surface-2);border-color:var(--text-3)}.button:hover{background:var(--accent);filter:brightness(1.1)}.mini-button,.subtle-link,.danger-button.mini,.page-link{height:28px;padding:0 9px;font-size:12px}.danger-button{background:var(--neg-soft);border-color:transparent;color:var(--neg)}.page-link.current{background:var(--accent);border-color:var(--accent);color:#fff}.grid{display:grid;gap:12px}.card{scroll-margin-top:76px}.library-card{padding:0;display:grid;gap:0}.card.highlight{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.card-head{padding:14px 16px;border-bottom:1px solid var(--border)}.eyebrow{color:var(--text-3);font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}.card-title{display:grid;gap:4px}.card-sub{color:var(--text-2);font-size:12.5px}.banner{display:grid;gap:10px;margin:14px 16px 0;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--accent-soft);grid-template-columns:auto minmax(0,1fr) auto;align-items:center}.banner-label{font-size:11px;color:var(--accent);letter-spacing:.06em;text-transform:uppercase;font-weight:600}.banner-main{display:grid;gap:2px;min-width:0}.banner-value{font-size:16px;font-weight:600;letter-spacing:-.02em;word-break:break-word}.banner-meta{color:var(--text-2);font-size:12px;line-height:1.4;word-break:break-word}.card-grid{display:grid;gap:16px;grid-template-columns:minmax(180px,1.05fr) minmax(240px,1.35fr) minmax(170px,.9fr);padding:16px}.section{display:grid;gap:10px;align-content:start;min-width:0}.section h4{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);font-weight:600}.utm-grid{display:grid;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr))}.utm-tile{min-height:64px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.utm-tile strong{display:block;margin-bottom:4px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}.utm-value{word-break:break-word;line-height:1.4;font-size:13px}.list{display:flex;flex-direction:column;gap:10px}.link-item,.usage-item{padding-bottom:10px;border-bottom:1px solid var(--border)}.link-item:last-child,.usage-item:last-child{padding-bottom:0;border-bottom:0}.link-label{margin-bottom:5px;color:var(--text-3);font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}.link-target{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:flex-start}.link-value{min-width:0;display:block;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--accent);text-decoration:none;word-break:break-word;line-height:1.45;font-family:"IBM Plex Mono",monospace;font-size:12px}.link-value:hover{text-decoration:underline}.qr-frame{width:min(100%,148px);aspect-ratio:1;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2);overflow:hidden;display:grid;place-items:center}.qr-frame img{width:100%;height:100%;display:block;object-fit:cover;background:#fff}.qr-placeholder{padding:14px;text-align:center;color:var(--text-3);line-height:1.45;font-size:12px}.usage-item{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.usage-item strong{color:var(--text-3);font-size:11px;letter-spacing:.06em;text-transform:uppercase}.usage-item span{text-align:right;line-height:1.4;font-size:12.5px}.warnings{display:flex;gap:6px;flex-wrap:wrap}details{border-top:1px solid var(--border);padding:12px 16px}details summary{cursor:pointer;color:var(--text-2);list-style:none;font-size:12.5px}details summary::-webkit-details-marker{display:none}details[open] summary{margin-bottom:10px}.request{margin:0;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);line-height:1.5;word-break:break-word;color:var(--text-2);font-size:13px}.empty{padding:28px;text-align:center;border:1px dashed var(--border-strong);border-radius:var(--radius);background:var(--surface-2)}.toast{position:fixed;right:16px;bottom:16px;max-width:22rem;padding:12px 14px;border-radius:var(--radius);background:var(--text);color:var(--surface);box-shadow:var(--shadow-lg);opacity:0;pointer-events:none;transform:translateY(12px);transition:opacity 140ms ease,transform 140ms ease;z-index:80}.toast.warning{background:var(--warn);color:#fff}.toast.error{background:var(--neg);color:#fff}.toast.success{background:var(--pos);color:#fff}.toast.visible{opacity:1;transform:translateY(0)}
    .card-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid var(--border);background:var(--surface-2);font-size:12.5px;color:var(--text-2)}.card-foot .foot-meta strong{color:var(--text)}.history-panel{padding:12px 16px;border-top:1px solid var(--border);background:var(--surface-2)}.history-list{display:flex;flex-direction:column;gap:8px}.history-event{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:baseline;font-size:12.5px}.history-event .h-action{font-weight:600;color:var(--text)}.history-event .h-actor{color:var(--text-2)}.history-event .h-when{color:var(--text-3);white-space:nowrap}.history-event .h-summary{grid-column:1/-1;color:var(--text-3);word-break:break-word}.bulk-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2)}.bulk-bar[hidden]{display:none}.select-link{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;cursor:pointer}.select-link input{width:17px;height:17px;accent-color:var(--accent)}.library-card.selected{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
    .compact-head{align-items:center;padding:8px 12px}.compact-identity{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.compact-identity h3{margin:0;font-size:14px;line-height:1.2}.compact-copy{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-left:auto}.compact-copy .mini-button{height:26px}.banner{margin:8px 12px 0;padding:7px 10px;gap:8px}.banner-value{font-size:14px}.banner-meta{font-size:11.5px;line-height:1.25}.compact-utm{padding:8px 12px 10px}.compact-utm h4{margin:0 0 5px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}.compact-utm .utm-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.compact-utm .utm-tile{min-height:0;padding:6px 8px}.compact-utm .utm-tile strong{margin-bottom:2px;font-size:9.5px}.compact-utm .utm-value{font-size:12px;line-height:1.25}.destination-path{font-family:"IBM Plex Mono",monospace;color:var(--accent)}.card-details{padding:0}.card-details>summary{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;font-weight:600}.card-details>summary:after{content:"+";font-size:16px;color:var(--text-3)}.card-details[open]>summary{margin-bottom:0;border-bottom:1px solid var(--border)}.card-details[open]>summary:after{content:"−"}.details-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface-2)}.details-grid{display:grid;gap:18px;grid-template-columns:minmax(280px,1.4fr) minmax(220px,.8fr);padding:16px}.request-details{margin:0}.request-details>summary{padding-left:16px;padding-right:16px}
    .gov-chip{padding-right:6px}.gov-ack{display:inline-flex;margin:0}.gov-ack button{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;min-height:0;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer;opacity:.65;transition:opacity .12s,background .12s}.gov-ack button:hover{opacity:1;background:color-mix(in srgb,currentColor 18%,transparent)}.gov-ack svg{width:13px;height:13px;stroke:currentColor;stroke-width:3;fill:none}
    ${renderLoadingStyles()}
    .compact-head{display:grid;grid-template-columns:auto minmax(220px,1fr) auto;gap:18px;padding:8px 12px}.compact-head .banner{display:flex;align-items:center;gap:10px;margin:0;padding:0;border:0;border-radius:0;background:transparent}.compact-head .banner-label{flex:0 0 auto}.compact-head .banner-main{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.compact-head .banner-value{font-size:14px}.compact-head .banner-meta{font-size:11.5px}.compact-head .destination-path{padding-left:10px;border-left:1px solid var(--border)}
    .library-results-grid>.library-card:nth-child(odd){background:var(--surface)}.library-results-grid>.library-card:nth-child(even){background:var(--surface-2)}.compact-utm h4{color:var(--text-2)}.compact-utm .utm-tile{background:var(--surface)}.compact-utm .utm-tile strong{color:var(--text-2);font-weight:700}.compact-utm .utm-value{color:var(--text)}
    .tabs{display:flex;gap:4px;border-bottom:1px solid var(--border)}.tab{padding:9px 14px;color:var(--text-2);text-decoration:none;font-weight:600;border-bottom:2px solid transparent}.tab:hover{color:var(--text)}.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
    @media (max-width:1280px){.library-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.library-filters .advanced-fields{grid-template-columns:repeat(3,minmax(0,1fr))}.card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section.details-rail{grid-column:span 2}.banner{grid-template-columns:auto minmax(0,1fr)}.compact-utm .utm-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media (max-width:860px){.library-filters,.library-filters .advanced-fields,.card-grid,.utm-grid,.details-grid{grid-template-columns:1fr}.section.details-rail{grid-column:auto}.banner{grid-template-columns:1fr}.results-head,.panel-head,.card-head,.pagination,.usage-item,.link-target{display:grid}.usage-item span{text-align:left}.compact-head{grid-template-columns:1fr}.compact-utm .utm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.compact-copy{margin:0}}
  </style>
</head>
<body>
  ${renderJustFlowThemeScript()}
  <div class="app">
    ${renderJustFlowSidebar("library", { standaloneUtm: view.standalone, user: view.user })}
    <main class="main">
      ${renderJustFlowTopbar({ section: "UTM Builder", title: "Link Library", searchPlaceholder: "Search clients, campaigns, links...", showSearch: !view.standalone })}
      <div class="page">
        <div class="library-flow">
          ${library.filters.view === "archived" ? "" : renderGovernancePanel(governance, { canManage: canManageGovernance })}
          <div class="page-header">
            <div class="page-title-block">
              <h1>Link Library</h1>
              <p class="subtitle">Browse every tracked link in one place, filter by campaign or source, and update a link when you need a new version.</p>
            </div>
            <div class="page-actions">
              <span class="badge"><strong class="num">${activeFilterCount}</strong> active filter${activeFilterCount === 1 ? "" : "s"}</span>
              <a class="btn" href="/new">${renderIcon("link")} New Link</a>
              <a class="btn" href="/imports">${renderIcon("download")} Import CSV</a>
              <a class="btn" href="${csvHref}">${renderIcon("download")} Download CSV</a>
              <a class="btn" href="${jsonHref}">${renderIcon("download")} Download JSON</a>
            </div>
          </div>
          <nav class="tabs" aria-label="Link library views">
            <a class="tab${library.filters.view === "active" ? " active" : ""}" href="/utms">Active</a>
            <a class="tab${library.filters.view === "archived" ? " active" : ""}" href="/utms?view=archived">Archived</a>
          </nav>
          <div class="kpi-grid library-kpis">
            <div class="kpi"><div class="kpi-label">Total links</div><div class="kpi-value num">${library.summary.totalUniqueLinks}</div><div class="kpi-sub">Saved tracked links</div></div>
            <div class="kpi"><div class="kpi-label">Links shown</div><div class="kpi-value num">${library.summary.filteredLinks}</div><div class="kpi-sub">Current filter result</div></div>
            <div class="kpi"><div class="kpi-label">Link saves</div><div class="kpi-value num">${library.summary.requestsRepresented}</div><div class="kpi-sub">Saved versions represented</div></div>
            <div class="kpi"><div class="kpi-label">QR codes</div><div class="kpi-value num">${library.summary.withQr}</div><div class="kpi-sub">Links with QR assets</div></div>
          </div>
          ${library.pending ? `<div class="alert-row ok">${renderIcon("refresh")}<div><div class="title">Library is warming in the background.</div><div class="body">This avoids request timeouts on large link libraries. The page will refresh automatically when the cached snapshot is ready.</div></div></div>` : ""}
          <section class="card">
            <div class="card-header">
              <div>
                <h3>Find Links</h3>
                <div class="meta">Search by client, campaign, destination page, or message text. Use source and medium when you need a more exact match.</div>
              </div>
              <span class="badge"><strong class="num">${library.summary.withoutShortLink}</strong> shown without short link</span>
            </div>
            <div class="card-body">
              <form method="get" action="/utms" class="control-bar library-filters" id="library-filter-form">
                <div class="field"><label>Search</label><input type="search" name="search" value="${escapeHtml(library.filters.search)}" placeholder="Client, campaign, URL, or message"></div>
                <div class="field"><label>Client</label><select name="client">${renderOptions("All clients", "", library.available.clients, library.filters.client, formatClientOptionLabel)}</select></div>
                <div class="field"><label>Source</label><select name="source">${renderTextOptions("All sources", "", library.available.sources, library.filters.source)}</select></div>
                <div class="field"><label>Medium</label><select name="medium">${renderTextOptions("All mediums", "", library.available.mediums, library.filters.medium)}</select></div>
                <div class="field"><label>Campaign name</label><input type="text" name="campaign" value="${escapeHtml(library.filters.campaign)}" placeholder="spring_sale"></div>
                <button class="button" type="submit">${renderIcon("search")} Show Links</button>
                <a class="link-button" href="/utms${library.filters.view === "archived" ? "?view=archived" : ""}">Clear Filters</a>
                <div class="advanced-fields">
                  <div class="field"><label>Term</label><input type="search" name="term" value="${escapeHtml(library.filters.term)}" placeholder="Filter term"></div>
                  <div class="field"><label>Content</label><input type="search" name="content" value="${escapeHtml(library.filters.content)}" placeholder="Filter content"></div>
                  <div class="field"><label>Status</label><select name="status">${renderOptions("All statuses", "all", library.available.statuses.filter((value) => value !== "all"), library.filters.status)}</select></div>
                  <div class="field"><label>Short link</label><select name="short_link">${renderToggleOptions(library.available.shortLinkStates, library.filters.shortLink)}</select></div>
                  <div class="field"><label>QR code</label><select name="qr">${renderToggleOptions(library.available.qrStates, library.filters.qr)}</select></div>
                  <div class="field"><label>Sort</label><select name="sort">${renderSortOptions(library.available.sorts, library.filters.sort)}</select></div>
                  <div class="field"><label>Links per page</label><select name="per_page">${renderPerPageOptions(library.filters.perPage)}</select></div>
                </div>
                <input type="hidden" name="page" value="1">
                <input type="hidden" name="view" value="${escapeAttribute(library.filters.view)}">
              </form>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <h3>Matching Links</h3>
                <div class="meta">Page ${library.pagination.page} of ${library.pagination.pageCount} - ${library.pagination.total} link(s) found</div>
              </div>
              <div class="chips">
                <span class="chip neutral">${escapeHtml(SORT_LABELS[library.filters.sort] ?? "Newest first")}</span>
                <span class="chip neutral">${library.summary.requestsRepresented} saved version${library.summary.requestsRepresented === 1 ? "" : "s"} included</span>
              </div>
            </div>
            <div class="card-body">
              <div class="bulk-bar" id="bulk-bar">
                <label class="select-link"><input type="checkbox" id="select-page"> Select all on this page</label>
                <span class="meta" id="selected-count">0 selected</span>
                <button type="button" class="button mini-button" data-bulk-action="short">Generate Bitlys</button>
                <button type="button" class="mini-button" data-bulk-action="qr">Generate QR codes</button>
                ${canManageGovernance ? library.filters.view === "archived"
                  ? `<button type="button" class="button mini-button" data-bulk-action="restore">Restore selected</button>`
                  : `<button type="button" class="danger-button mini" data-bulk-action="archive">Archive selected</button>` : ""}
              </div>
              ${highlightRequestId ? (() => { const hi = library.items.find((i) => i.requestId === highlightRequestId); return `<div class="meta" style="margin-bottom:12px"><a class="link" href="/utms">Link Library</a> / ${escapeHtml(hi ? (hi.utmCampaign || `Link ${hi.requestId}`) : "Link")}</div>`; })() : ""}
              <div class="grid library-results-grid">
                ${library.items.length > 0
                    ? library.items.map((item) => renderResultCard(item, { highlightRequestId, archived: library.filters.view === "archived", canManage: canManageGovernance })).join("")
                    : `<div class="empty">${library.pending ? "Preparing the cached link library snapshot. This page will refresh automatically." : "No saved links matched your filters."}</div>`}
              </div>
              <div class="pagination" style="margin-top:14px">
                <div class="meta">Open any card to review saved values and actions.</div>
                <div class="page-links">${renderPaginationLinks(library.pagination, queryBase)}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
  <div class="toast ${escapeAttribute(toastLevel)}" id="toast" aria-live="polite">${escapeHtml(toast)}</div>
  <script>
    (function () {
      const toast = document.getElementById("toast");
      const filterForm = document.getElementById("library-filter-form");
      const selectPage = document.getElementById("select-page");
      const selectedCount = document.getElementById("selected-count");
      let facetAbortController = null;
      let facetRequestToken = 0;
      let toastTimer = null;
      const toggleLabels = {
        all: "All",
        with_qr: "With QR",
        without_qr: "Without QR",
        with_short_link: "With short link",
        without_short_link: "No short link"
      };
      function showToast(message, level) {
        if (!toast || !message) return;
        toast.textContent = message;
        toast.className = "toast visible" + (level ? " " + level : "");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
      }
      function selectedIds() {
        return Array.from(document.querySelectorAll("[data-link-select]:checked")).map((input) => input.value);
      }
      function updateSelection() {
        const boxes = Array.from(document.querySelectorAll("[data-link-select]"));
        const selected = boxes.filter((input) => input.checked);
        boxes.forEach((input) => input.closest(".library-card")?.classList.toggle("selected", input.checked));
        if (selectedCount) selectedCount.textContent = selected.length + " selected";
        if (selectPage) {
          selectPage.checked = boxes.length > 0 && selected.length === boxes.length;
          selectPage.indeterminate = selected.length > 0 && selected.length < boxes.length;
        }
        document.querySelectorAll("[data-bulk-action]").forEach((button) => { button.disabled = selected.length === 0; });
      }
      selectPage?.addEventListener("change", function () {
        document.querySelectorAll("[data-link-select]").forEach((input) => { input.checked = selectPage.checked; });
        updateSelection();
      });
      document.addEventListener("change", function (event) {
        if (event.target.matches("[data-link-select]")) updateSelection();
      });
      async function chooseQrProject() {
        const response = await fetch("/new/qr-projects.json", { headers: { "Accept": "application/json" } });
        const body = await response.json();
        if (!response.ok || body.status !== "ok") throw new Error(body?.error?.message || "QR Stuff projects could not be loaded.");
        const projects = Array.isArray(body.projects) ? body.projects : [];
        if (!projects.length) throw new Error("No QR Stuff projects are available.");
        const dialog = document.createElement("dialog");
        dialog.style.cssText = "border:0;border-radius:16px;padding:0;max-width:520px;width:calc(100% - 32px);box-shadow:0 24px 70px rgba(0,0,0,.28)";
        dialog.innerHTML = '<form method="dialog" style="padding:22px;display:grid;gap:14px"><h3 style="margin:0">Choose QR Stuff project</h3><div class="meta">Select where this QR code should be created.</div><label class="field"><span>Search projects</span><input type="search" data-qr-project-search placeholder="Search project names" autocomplete="off"></label><label class="field"><span>Project</span><select data-qr-project-select required></select></label><div class="actions"><button type="button" class="mini-button" data-qr-project-cancel>Cancel</button><button type="submit" class="btn btn-primary">Continue</button></div></form>';
        document.body.appendChild(dialog);
        const search = dialog.querySelector("[data-qr-project-search]");
        const select = dialog.querySelector("[data-qr-project-select]");
        function render() { const query = search.value.trim().toLowerCase(); const filtered = projects.filter((project) => String(project.name).toLowerCase().includes(query)); select.innerHTML = '<option value="">Select a project</option>' + filtered.map((project) => '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.name) + '</option>').join(""); }
        render();
        search.addEventListener("input", render);
        return await new Promise((resolve) => {
          let completed = false;
          function finish(value) { if (completed) return; completed = true; dialog.close(); dialog.remove(); resolve(value); }
          dialog.querySelector("[data-qr-project-cancel]").addEventListener("click", () => finish(null));
          dialog.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); if (select.value) finish(Number(select.value)); });
          dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(null); });
          dialog.showModal(); search.focus();
        });
      }
      document.addEventListener("click", async function (event) {
        const button = event.target.closest("[data-bulk-action]");
        if (!button) return;
        const ids = selectedIds();
        const action = button.dataset.bulkAction;
        if (!ids.length) return;
        if (action === "archive" && !window.confirm("Archive " + ids.length + " selected links? Nothing will be deleted.")) return;
        let qrProjectId = null;
        if (action === "qr") { try { qrProjectId = await chooseQrProject(); } catch (error) { showToast(error?.message || "QR Stuff projects could not be loaded.", "error"); return; } if (!qrProjectId) return; }
        document.querySelectorAll("[data-bulk-action]").forEach((item) => { item.disabled = true; });
        button.classList.add("btn-loading");
        try {
          const response = await fetch("/utms/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, request_ids: ids, qr_project_id: qrProjectId }) });
          const body = await response.json();
          if (!body.succeeded) throw new Error(body?.error?.message || body?.results?.[0]?.message || "The bulk action failed.");
          const label = action === "short" ? "Bitly generation" : action === "qr" ? "QR generation" : action === "restore" ? "Restore" : "Archive";
          const message = label + " completed for " + body.succeeded + " of " + body.selected + " selected links.";
          const next = new URL(window.location.href);
          next.searchParams.set("toast", message);
          next.searchParams.set("toast_level", body.failed ? "warning" : "success");
          window.location.assign(next.toString());
        } catch (error) {
          showToast(error?.message || "The bulk action failed.", "error");
          button.classList.remove("btn-loading");
          updateSelection();
        }
      });
      updateSelection();
      document.querySelectorAll(".card-details").forEach(function (details) {
        details.addEventListener("toggle", function () {
          const label = details.querySelector(":scope > summary [data-details-label]");
          if (label) label.textContent = details.open ? "Hide details and actions" : "View details and actions";
        });
      });
      async function copyText(value) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
          return true;
        }
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "readonly");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(input);
        return copied;
      }
      document.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-copy]");
        if (!button) return;
        event.preventDefault();
        try {
          const ok = await copyText(button.getAttribute("data-copy") || "");
          showToast(ok ? "Copied to clipboard" : "Copy failed", ok ? "success" : "error");
        } catch {
          showToast("Copy failed", "error");
        }
      });
      document.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-archive-request-id],[data-restore-request-id]");
        if (!button) return;
        event.preventDefault();
        const restoring = button.hasAttribute("data-restore-request-id");
        const requestId = button.getAttribute(restoring ? "data-restore-request-id" : "data-archive-request-id");
        if (!requestId) return;
        if (!restoring && !window.confirm("Archive this saved link? All history will be preserved.")) {
          return;
        }
        button.classList.add("btn-loading");
        button.disabled = true;
        try {
          const response = await fetch(restoring ? "/utms/restore" : "/utms/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request_id: requestId })
          });
          const body = await response.json();
          if (!response.ok || body.status !== "ok") {
            const message = body && body.error && body.error.message ? body.error.message : "Unable to update this saved link right now.";
            showToast(message, "error");
            return;
          }
          window.location.assign(body.redirect_url || "/utms");
        } catch (error) {
          const message = error && error.message ? error.message : "Unable to update this saved link right now.";
          showToast(message, "error");
        } finally {
          button.classList.remove("btn-loading");
          button.disabled = false;
        }
      });
      document.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-generate-asset]");
        if (!button) return;
        event.preventDefault();
        const requestId = button.getAttribute("data-request-id");
        const asset = button.getAttribute("data-generate-asset");
        if (!requestId || !["short", "qr"].includes(asset)) return;
        button.classList.add("btn-loading");
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        try {
          const qrProjectId = asset === "qr" ? await chooseQrProject() : null;
          if (asset === "qr" && !qrProjectId) return;
          const response = await fetch("/utms/supplement", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request_id: requestId,
              generate_short: asset === "short",
              generate_qr: asset === "qr",
              qr_project_id: qrProjectId
            })
          });
          const body = await response.json();
          if (!response.ok || body.status !== "ok") {
            const message = body && body.error && body.error.message ? body.error.message : "Unable to generate this asset right now.";
            showToast(message, "error");
            return;
          }
          window.location.assign(body.redirect_url || "/utms");
        } catch (error) {
          const message = error && error.message ? error.message : "Unable to generate this asset right now.";
          showToast(message, "error");
        } finally {
          button.classList.remove("btn-loading");
          button.disabled = false;
          button.removeAttribute("aria-busy");
        }
      });
      document.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-history-toggle]");
        if (!button) return;
        event.preventDefault();
        const fingerprint = button.getAttribute("data-fingerprint");
        if (!fingerprint) return;
        const panel = document.querySelector("[data-history-panel='" + (window.CSS && CSS.escape ? CSS.escape(fingerprint) : fingerprint) + "']");
        if (!panel) return;
        const isHidden = panel.hasAttribute("hidden");
        if (!isHidden) {
          panel.setAttribute("hidden", "");
          button.setAttribute("aria-expanded", "false");
          button.textContent = "View edit history";
          return;
        }
        button.setAttribute("aria-expanded", "true");
        button.textContent = "Hide edit history";
        panel.removeAttribute("hidden");
        if (panel.dataset.loaded !== "true") {
          panel.innerHTML = '<div class="meta">Loading history...</div>';
          try {
            const response = await fetch("/utms/history.json?fingerprint=" + encodeURIComponent(fingerprint), { headers: { "Accept": "application/json" } });
            const body = await response.json();
            const events = (body && body.events) || [];
            panel.dataset.loaded = "true";
            panel.innerHTML = events.length
              ? '<div class="history-list">' + events.map(function (eventItem) {
                  return '<div class="history-event"><span class="h-action">' + escapeHtml(eventItem.action_label) + '</span>'
                    + '<span class="h-actor">by ' + escapeHtml(eventItem.actor) + '</span>'
                    + '<span class="h-when">' + escapeHtml(eventItem.at_label || "") + '</span>'
                    + (eventItem.summary ? '<span class="h-summary">' + escapeHtml(eventItem.summary) + '</span>' : "")
                    + '</div>';
                }).join("") + '</div>'
              : '<div class="meta">No recorded history for this link yet. New edits will appear here.</div>';
          } catch (error) {
            panel.innerHTML = '<div class="meta">Unable to load history right now.</div>';
          }
        }
      });
      function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }
      const highlighted = document.querySelector("[data-highlight='true']");
      if (highlighted) {
        highlighted.scrollIntoView({ block: "start" });
      }
      if (toast && toast.textContent.trim()) {
        showToast(toast.textContent.trim(), toast.classList.contains("warning") ? "warning" : toast.classList.contains("error") ? "error" : "success");
      }
      const libraryPending = ${library.pending ? "true" : "false"};
      if (libraryPending) {
        window.setTimeout(function () {
          const next = new URL(window.location.href);
          next.searchParams.set("_library_refresh", String(Date.now()));
          window.location.replace(next.toString());
        }, 1800);
      }

      function humanizeLabel(value) {
        return String(value || "")
          .split(/[_-]+/g)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      }

      function updateSelectOptions(selectName, values, defaultLabel, defaultValue, formatter) {
        if (!filterForm) return;
        const select = filterForm.elements.namedItem(selectName);
        if (!select) return;

        const previousValue = select.value;
        const allowedValues = Array.isArray(values) ? values.filter(Boolean) : [];
        const options = [{ value: defaultValue, label: defaultLabel }]
          .concat(allowedValues.map((value) => ({ value, label: formatter(value) })));

        select.replaceChildren(...options.map((option) => new Option(option.label, option.value)));

        const nextValue = options.some((option) => option.value === previousValue)
          ? previousValue
          : defaultValue;
        select.value = nextValue;
      }

      function setFacetLoadingState() {
        if (!filterForm) return;
        ["client", "source", "medium", "status", "short_link", "qr"].forEach((name) => {
          const select = filterForm.elements.namedItem(name);
          if (!select) return;
          const currentValue = select.value;
          const currentLabel = select.options[select.selectedIndex]
            ? select.options[select.selectedIndex].text
            : "Loading...";
          const loadingLabel = currentValue ? currentLabel + " (updating...)" : "Loading...";
          select.dataset.pendingValue = currentValue;
          select.replaceChildren(new Option(loadingLabel, currentValue || ""));
          select.value = currentValue || "";
          select.disabled = true;
          select.setAttribute("aria-busy", "true");
        });
      }

      function clearFacetLoadingState() {
        if (!filterForm) return;
        ["client", "source", "medium", "status", "short_link", "qr"].forEach((name) => {
          const select = filterForm.elements.namedItem(name);
          if (!select) return;
          select.disabled = false;
          select.removeAttribute("aria-busy");
          delete select.dataset.pendingValue;
        });
      }

      async function refreshFacetOptions() {
        if (!filterForm) return;

        const params = new URLSearchParams();
        for (const [key, rawValue] of new FormData(filterForm).entries()) {
          if (key === "page") {
            continue;
          }
          const value = String(rawValue || "");
          params.set(key, value);
        }
        params.set("page", "1");

        if (facetAbortController) {
          facetAbortController.abort();
        }
        facetAbortController = new AbortController();
        const requestToken = ++facetRequestToken;
        setFacetLoadingState();

        try {
          const response = await fetch("/utms.json?" + params.toString(), {
            headers: { "Accept": "application/json" },
            signal: facetAbortController.signal
          });
          if (!response.ok) return;
          const body = await response.json();
          if (!body || !body.available || requestToken !== facetRequestToken) return;

          updateSelectOptions("client", body.available.clients || [], "All clients", "", function(value){return String(value||"").trim().toUpperCase()});
          updateSelectOptions("source", body.available.sources || [], "All sources", "", (value) => value);
          updateSelectOptions("medium", body.available.mediums || [], "All mediums", "", (value) => value);
          updateSelectOptions("status", (body.available.statuses || []).filter((value) => value !== "all"), "All statuses", "all", humanizeLabel);
          updateSelectOptions("short_link", (body.available.shortLinkStates || []).filter((value) => value !== "all"), "All", "all", (value) => toggleLabels[value] || humanizeLabel(value));
          updateSelectOptions("qr", (body.available.qrStates || []).filter((value) => value !== "all"), "All", "all", (value) => toggleLabels[value] || humanizeLabel(value));
        } catch (error) {
          if (error && error.name === "AbortError") {
            return;
          }
        } finally {
          if (requestToken === facetRequestToken) {
            clearFacetLoadingState();
          }
        }
      }

      if (filterForm) {
        let refreshTimer = null;
        const queueFacetRefresh = () => {
          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(refreshFacetOptions, 120);
        };

        filterForm.addEventListener("change", (event) => {
          if (!event.target || !event.target.name) return;
          if (["client", "source", "medium", "status", "short_link", "qr"].includes(event.target.name)) {
            refreshFacetOptions();
            return;
          }
          queueFacetRefresh();
        });
        filterForm.addEventListener("input", (event) => {
          if (!event.target || !event.target.name) return;
          if (["search", "campaign", "term", "content"].includes(event.target.name)) {
            queueFacetRefresh();
          }
        });
      }
    })();
  </script>
</body>
</html>`;
}

function renderCsv(items) {
  const header = [
    "request_id",
    "status",
    "client",
    "channel",
    "asset_type",
    "campaign_label",
    "canonical_campaign",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "destination_url",
    "final_long_url",
    "short_url",
    "qr_url",
    "request_count",
    "first_seen_at",
    "last_seen_at",
    "original_message"
  ];
  const lines = [
    header.join(","),
    ...items.map((item) => [
      item.requestId,
      item.status,
      item.clientDisplayName,
      item.channelDisplayName,
      item.assetType,
      item.campaignLabel,
      item.canonicalCampaign,
      item.utmSource,
      item.utmMedium,
      item.utmCampaign,
      item.utmTerm,
      item.utmContent,
      item.destinationUrl,
      item.finalLongUrl,
      item.shortUrl,
      item.qrUrl,
      item.requestCount,
      item.firstCreatedAt,
      item.lastCreatedAt,
      item.originalMessage
    ].map(escapeCsv).join(","))
  ];

  return `${lines.join("\n")}\n`;
}

function renderGovernancePanel(governance, { canManage = false } = {}) {
  if (!governance || !governance.totalNewValues) {
    return "";
  }
  return `<section class="card">
    <div class="card-header">
      <div>
        <h3>Consistency Warnings To Review</h3>
        <div class="meta">These client-specific values and combinations were explicitly confirmed during link creation. Review them so naming drift does not spread into reporting.${canManage ? " Acknowledge an intentional standard to remove it from future warnings." : ""}</div>
      </div>
      <div class="chips">
        <span class="chip warning">${governance.totalNewValues} items</span>
      </div>
    </div>
    <div class="card-body">
      <div class="alert-row warn">${renderIcon("warning")}<div><div class="title">Review naming drift before it spreads.</div><div class="body">New UTM values can fragment campaign reporting if they are not normalized.</div></div></div>
      <div class="section-row-3">
      ${governance.fields.filter((field) => field.items.length).map((field) => `<div class="qi-tile">
        <div class="l">${escapeHtml(field.label)}</div>
        <div class="v num">${field.items.length}</div>
        <div class="warnings" style="margin-top:.6rem">${field.items.slice(0, 8).map((item) => renderGovernanceChip(field.key, item, canManage)).join("")}</div>
      </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderGovernanceChip(fieldKey, item, canManage) {
  const displayValue = displayGovernanceValue(item.client, item.value);
  const acknowledgeForm = canManage
    ? `<form method="post" action="/utms/governance/acknowledge" class="gov-ack">
        <input type="hidden" name="field" value="${escapeAttribute(item.storageField)}">
        <input type="hidden" name="value" value="${escapeAttribute(item.value)}">
        <input type="hidden" name="client" value="${escapeAttribute(item.client)}">
        <input type="hidden" name="warning_type" value="${escapeAttribute(item.type)}">
        <button type="submit" title="Acknowledge this value" aria-label="Acknowledge ${escapeAttribute(displayValue)}">${renderIcon("check")}</button>
      </form>`
    : "";
  return `<span class="chip warning gov-chip" title="${escapeAttribute(item.message)}" data-governance-field="${escapeAttribute(fieldKey)}" data-governance-value="${escapeAttribute(item.value)}">${escapeHtml(item.client)}: ${escapeHtml(displayValue)} (${item.count}) · ${escapeHtml(item.createdBy ?? "System")} · ${escapeHtml(formatDate(item.createdAt))}${acknowledgeForm}</span>`;
}

export function displayGovernanceValue(client, value) {
  const rawValue = String(value ?? "");
  const key = `${String(client ?? "").trim().toLowerCase()}|${rawValue.trim().toLowerCase()}`;
  return LEGACY_GOVERNANCE_DISPLAY_VALUES.get(key) ?? rawValue;
}

function renderResultCard(item, { highlightRequestId, archived = false, canManage = false }) {
  const campaignValue = item.utmCampaign || item.canonicalCampaign || "(none)";
  const campaignMeta = buildCampaignMeta(item, campaignValue);
  const isHighlighted = highlightRequestId === item.requestId;
  const trackedUrl = hideInternalTracking(item.finalLongUrl);
  const destinationPath = displayDestinationPath(item.destinationUrl);

  return `<article class="card library-card${isHighlighted ? " highlight" : ""}" id="request-${item.requestId}" data-highlight="${isHighlighted ? "true" : "false"}">
    <div class="card-head compact-head">
      <div class="compact-identity">
        <label class="select-link"><input type="checkbox" data-link-select value="${escapeAttribute(item.requestId)}" aria-label="Select ${escapeAttribute(item.clientDisplayName)} link"> Select link</label>
        <h3>${escapeHtml(item.clientDisplayName)}</h3>
      </div>
      <div class="banner">
        <div class="banner-label">Campaign</div>
        <div class="banner-main">
          <div class="banner-value">${escapeHtml(campaignValue)}</div>
          ${campaignMeta ? `<div class="banner-meta">${escapeHtml(campaignMeta)}</div>` : ""}
          <div class="banner-meta destination-path">${escapeHtml(destinationPath)}</div>
        </div>
      </div>
      <div class="compact-copy">
        ${trackedUrl ? renderCopyButton(trackedUrl, "Copy tracked link") : ""}
        ${item.shortUrl ? renderCopyButton(item.shortUrl, "Copy Bitly") : ""}
      </div>
    </div>
    <section class="compact-utm">
        <h4>UTM Values</h4>
        <div class="utm-grid">
          ${renderUtmTile("Source", item.utmSource)}
          ${renderUtmTile("Medium", item.utmMedium)}
          ${renderUtmTile("Campaign", item.utmCampaign)}
          ${renderUtmTile("Term", item.utmTerm)}
          ${renderUtmTile("Content", item.utmContent)}
        </div>
    </section>
    <details class="card-details">
      <summary><span data-details-label>View details and actions</span></summary>
      <div class="details-actions">
        <div class="mini-actions">
          <a class="mini-button" href="/new?duplicate_request_id=${escapeAttribute(item.requestId)}">Duplicate</a>
          ${!canManage ? "" : archived
            ? `<button type="button" class="button mini-button" data-restore-request-id="${escapeAttribute(item.requestId)}">Restore Link</button>`
            : `<button type="button" class="danger-button mini" data-archive-request-id="${escapeAttribute(item.requestId)}">Archive Link</button>`}
        </div>
        <div class="chips">
          ${renderChip(item.assetType)}
          ${renderStatusChip(item.status)}
          ${renderChip(item.hasShortUrl ? "Short link ready" : "No short link", item.hasShortUrl ? "default" : "warning")}
          ${renderChip(item.hasQr ? "QR code ready" : "No QR code", item.hasQr ? "default" : "neutral")}
          <span class="chip neutral">${item.requestCount} saved version${item.requestCount === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div class="details-grid">
      <section class="section">
        <h4>Links</h4>
        <div class="list">
          ${renderLinkItem("Destination page", item.destinationUrl)}
          ${renderLinkItem("Tracked link", trackedUrl)}
          ${renderLinkItem("Short link", item.shortUrl, {
            requestId: item.requestId,
            asset: "short",
            buttonLabel: "Generate short link"
          })}
        </div>
      </section>
      <section class="section details-rail">
        <h4>QR Code And Details</h4>
        ${renderQrPanel(item)}
        <div class="list">
          ${renderUsageItem("Last saved", formatDate(item.lastCreatedAt))}
          ${renderUsageItem("First saved", formatDate(item.firstCreatedAt))}
          ${renderUsageItem("Latest update", item.reusedExisting ? "Reused an existing short link" : "Created or refreshed this link")}
        </div>
        ${renderWarnings(item.warnings)}
      </section>
      </div>
    <details class="request-details">
      <summary>Show original request text</summary>
      <p class="request">${escapeHtml(item.originalMessage || "No original request text was saved.")}</p>
    </details>
    <div class="card-foot">
      <div class="foot-meta">Created by <strong>${escapeHtml(item.createdByName)}</strong>${item.createdAt ? ` · ${escapeHtml(formatDate(item.createdAt))}` : ""}</div>
      ${item.fingerprint ? `<button type="button" class="subtle-link" data-history-toggle data-fingerprint="${escapeAttribute(item.fingerprint)}" aria-expanded="false">View edit history</button>` : ""}
    </div>
    ${item.fingerprint ? `<div class="history-panel" data-history-panel="${escapeAttribute(item.fingerprint)}" hidden></div>` : ""}
    </details>
  </article>`;
}

export function summarizeGovernance(items, utmIntelligenceService, acknowledgedSet = new Set()) {
  if (!utmIntelligenceService) {
    return {
      totalNewValues: 0,
      fields: []
    };
  }
  const grouped = new Map();
  items.forEach((item) => {
    (item.acceptedConsistencyWarnings ?? []).forEach((warning) => {
      if (!["new_value", "new_pairing", "new_combination"].includes(warning.type)) return;
      const fields = warning.fields ?? [];
      const storageField = warning.type === "new_pairing" ? `pair:${fields.join("+")}`
        : warning.type === "new_combination" ? "combination" : fields[0];
      const value = warning.type === "new_combination"
        ? fields.map((field) => `${field}=${warning.values?.[field] ?? ""}`).join("|")
        : fields.map((field) => warning.values?.[field] ?? "").join("|");
      const client = normalizeTextValue(item.client);
      if (!client || !value || acknowledgedSet.has(acknowledgementKey(`${client}|${storageField}`, value))) return;
      const key = `${client}|${storageField}|${value}`;
      const current = grouped.get(key) ?? {
        client, storageField, value, type: warning.type, fields,
        message: warning.message, count: 0, createdBy: item.createdByName, createdAt: item.createdAt
      };
      current.count += Number(item.requestCount ?? 1);
      grouped.set(key, current);
    });
  });
  const labels = { new_value: "New values", new_pairing: "New pairings", new_combination: "New combinations" };
  const fields = Object.entries(labels).map(([type, label]) => ({
    key: type,
    label,
    items: [...grouped.values()].filter((item) => item.type === type)
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
  }));
  return {
    totalNewValues: fields.reduce((sum, field) => sum + field.items.length, 0),
    fields
  };
}

function buildCampaignMeta(item, campaignValue) {
  const candidates = [
    item.campaignLabel,
    item.canonicalCampaign
  ].map((value) => String(value ?? "").trim()).filter(Boolean);

  const firstDifferent = candidates.find((value) => normalizeComparable(value) !== normalizeComparable(campaignValue));
  if (firstDifferent) {
    return `Label: ${firstDifferent}`;
  }

  if (item.utmTerm && item.utmContent) {
    return `Term ${item.utmTerm} · Content ${item.utmContent}`;
  }

  if (item.utmTerm) {
    return `Term ${item.utmTerm}`;
  }

  if (item.utmContent) {
    return `Content ${item.utmContent}`;
  }

  return "";
}

function renderOptions(defaultLabel, defaultValue, values, selected, labelFormatter = humanize) {
  const options = [`<option value="${escapeHtml(defaultValue)}"${selected === defaultValue ? " selected" : ""}>${escapeHtml(defaultLabel)}</option>`];
  values.forEach((value) => {
    options.push(`<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(labelFormatter(value))}</option>`);
  });
  return options.join("");
}

function formatClientOptionLabel(value) {
  return String(value ?? "").trim().toUpperCase();
}

function renderTextOptions(defaultLabel, defaultValue, values, selected) {
  const options = [`<option value="${escapeHtml(defaultValue)}"${selected === defaultValue ? " selected" : ""}>${escapeHtml(defaultLabel)}</option>`];
  values.forEach((value) => {
    options.push(`<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(value)}</option>`);
  });
  return options.join("");
}

function renderToggleOptions(values, selected) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(TOGGLE_LABELS[value] ?? humanize(value))}</option>`)
    .join("");
}

function renderSortOptions(values, selected) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(SORT_LABELS[value] ?? humanize(value))}</option>`)
    .join("");
}

function renderPerPageOptions(selected) {
  return [12, 24, 48, 96]
    .map((value) => `<option value="${value}"${selected === value ? " selected" : ""}>${value}</option>`)
    .join("");
}

function renderChip(value, tone = "default") {
  if (!value) {
    return "";
  }

  const toneClass = tone === "warning"
    ? " warning"
    : tone === "error"
      ? " error"
      : tone === "neutral"
        ? " neutral"
        : "";

  return `<span class="chip${toneClass}">${escapeHtml(humanize(value))}</span>`;
}

function renderStatusChip(status) {
  if (!status) {
    return "";
  }

  const label = status === "completed_without_short_link"
    ? "Saved without short link"
    : status === "completed"
      ? "Saved"
      : humanize(status);
  return renderChip(label, status === "completed_without_short_link" ? "warning" : "default");
}

function renderUtmTile(label, value) {
  const display = value ? value : "—";
  return `<div class="utm-tile"><strong>${escapeHtml(label)}</strong><div class="utm-value">${escapeHtml(display)}</div></div>`;
}

function renderLinkItem(label, url, missingAction = null) {
  if (!url) {
    return `<div class="link-item">
      <div class="link-label">${escapeHtml(label)}</div>
      <div class="meta">Not available for this link.</div>
      ${missingAction ? `<div class="mini-actions" style="margin-top:8px">${renderGenerateAssetButton(missingAction)}</div>` : ""}
    </div>`;
  }

  return `<div class="link-item">
    <div class="link-label">${escapeHtml(label)}</div>
    <div class="link-target">
      <a class="link-value" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>
      <div class="mini-actions">
        <a class="subtle-link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">Open</a>
        ${renderCopyButton(url)}
      </div>
    </div>
  </div>`;
}

function hideInternalTracking(url) {
  if (!url) {
    return url;
  }
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("jf_fp");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function displayDestinationPath(url) {
  if (!url) return "/";
  try {
    return new URL(url).pathname || "/";
  } catch {
    return String(url);
  }
}

function renderQrPanel(item) {
  if (!item.qrUrl) {
    return `<div class="section">
      <div class="qr-frame"><div class="qr-placeholder">No QR code has been created for this link yet.</div></div>
      <div class="mini-actions">${renderGenerateAssetButton({
        requestId: item.requestId,
        asset: "qr",
        buttonLabel: "Generate QR code"
      })}</div>
    </div>`;
  }

  const managed = item.qrUrl.startsWith("/qr-assets/");
  return `<div class="section">
    <div class="qr-frame"><div class="qr-placeholder">${managed ? "QR PDF is ready." : "Legacy QR code. Regenerate it to create a transparent PDF."}</div></div>
    <div class="mini-actions">
      <a class="subtle-link" href="${escapeAttribute(item.qrUrl)}">${managed ? "Download QR PDF" : "Open legacy QR"}</a>
      ${managed ? `<a class="subtle-link" href="${escapeAttribute(`${item.qrUrl}?inline=1`)}" target="_blank" rel="noreferrer">Open QR PDF</a>` : ""}
      ${!managed ? renderGenerateAssetButton({ requestId: item.requestId, asset: "qr", buttonLabel: "Regenerate with QR Stuff" }) : ""}
    </div>
  </div>`;
}

function renderUsageItem(label, value) {
  return `<div class="usage-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value || "--")}</span></div>`;
}

function renderWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    return "";
  }

  return `<div class="warnings">${warnings.map((warning) => `<span class="chip warning">${escapeHtml(warning)}</span>`).join("")}</div>`;
}

function renderCopyButton(value, label = "Copy") {
  return `<button type="button" class="mini-button" data-copy="${escapeAttribute(value)}">${escapeHtml(label)}</button>`;
}

function renderGenerateAssetButton({ requestId, asset, buttonLabel }) {
  return `<button type="button" class="mini-button" data-generate-asset="${escapeAttribute(asset)}" data-request-id="${escapeAttribute(requestId)}">${escapeHtml(buttonLabel)}</button>`;
}

function renderPaginationLinks(pagination, queryBase) {
  const links = [];

  if (pagination.hasPreviousPage) {
    links.push(`<a class="link-button" href="/utms?${buildQueryString({ ...queryBase, page: pagination.page - 1 })}">Previous</a>`);
  }

  buildPageWindow(pagination.page, pagination.pageCount).forEach((entry) => {
    if (entry === "...") {
      links.push(`<span class="meta">...</span>`);
      return;
    }

    if (entry === pagination.page) {
      links.push(`<span class="page-link current">${entry}</span>`);
      return;
    }

    links.push(`<a class="page-link" href="/utms?${buildQueryString({ ...queryBase, page: entry })}">${entry}</a>`);
  });

  if (pagination.hasNextPage) {
    links.push(`<a class="link-button" href="/utms?${buildQueryString({ ...queryBase, page: pagination.page + 1 })}">Next</a>`);
  }

  return links.join("");
}

function buildPageWindow(page, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((left, right) => left - right);
  const result = [];

  for (let index = 0; index < sorted.length; index += 1) {
    if (index > 0 && sorted[index] - sorted[index - 1] > 1) {
      result.push("...");
    }
    result.push(sorted[index]);
  }

  return result;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Date(value).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return String(value);
  }
}

function normalizeTextValue(value) {
  return String(value ?? "").trim();
}

function normalizeToastLevel(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["warning", "error"].includes(normalized)) {
    return normalized;
  }
  return "success";
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildQueryString(query) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "" || value === "all") {
      return;
    }

    params.set(key, String(value));
  });
  return params.toString();
}

function humanize(value) {
  return String(value ?? "")
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "");
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

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/gu, "\"\"")}"`;
}
