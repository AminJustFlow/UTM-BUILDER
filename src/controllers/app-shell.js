const NAV_ITEMS = [
  { key: "dashboard", href: "/admin", label: "Dashboard" },
  { key: "executive-summary", href: "/admin/executive-summary", label: "Executive" },
  { key: "library", href: "/utms", label: "Link Library" },
  { key: "builder", href: "/new", label: "New Link" },
  { key: "imports", href: "/imports", label: "Import Links" },
  { key: "websites", href: "/admin/websites", label: "Sites" },
  { key: "reports", href: "/admin/reports", label: "Reports" },
  { key: "snapshot", href: "/admin/snapshot", label: "Snapshot" },
  { key: "sales", href: "/admin/sales", label: "Sales" },
  { key: "leads", href: "/admin/leads", label: "Leads" },
  { key: "offline-conversions", href: "/admin/offline-conversions", label: "Offline Conv" },
  { key: "profiles", href: "/admin/profiles", label: "Profile Journeys" },
  { key: "link-performance", href: "/admin/link-performance", label: "Link Results" }
];

export const GENIE_ENABLED = false;
export const BRAND_HEAD_HTML = '<link rel="icon" type="image/png" sizes="40x48" href="/assets/jf-drop.png">';

export function renderAdminBaseStyles() {
  return `
    :root{--bg:#fafaf9;--panel:#fff;--panel-strong:#f5f5f4;--ink:#18181b;--muted:#52525b;--accent:#4f46e5;--accent-2:#f59e0b;--line:#e7e5e4;--line-strong:#d6d3d1;--shadow:0 12px 32px -8px rgba(15,15,25,.12),0 4px 8px -2px rgba(15,15,25,.06)}
    *{box-sizing:border-box}
    body{margin:0;color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg)}
    .shell{max-width:1560px;margin:0 auto;padding:1rem 1rem 3rem}
    .hero,.panel,.card,.table-card,.notice{background:var(--panel);border:1px solid var(--line);border-radius:.8rem;box-shadow:0 1px 2px rgba(15,15,25,.04)}
    .hero,.panel,.notice{padding:1.25rem 1.35rem;margin-bottom:1.25rem}
    h1,h2,h3{margin:0;font-family:inherit;letter-spacing:-.02em}
    .lede,.meta,.empty{color:var(--muted);line-height:1.5}
    .button,.link-button{display:inline-flex;align-items:center;justify-content:center;min-height:2.45rem;padding:.64rem .9rem;border-radius:.45rem;border:1px solid var(--line-strong);font:inherit;font-weight:500;text-decoration:none;cursor:pointer;background:var(--panel);color:var(--ink)}
    .button{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 10px 20px -12px rgba(79,70,229,.8)}
    label{display:grid;gap:.35rem;font-size:.9rem;color:var(--muted)}
    input,select,textarea{width:100%;padding:.72rem .82rem;border:1px solid var(--line);border-radius:.45rem;background:var(--panel-strong);color:var(--ink);font:inherit}
    textarea{resize:vertical}
    .table-wrap{overflow:auto}
    table{width:100%;border-collapse:collapse;font-size:.9rem}
    th,td{text-align:left;padding:.65rem .45rem;border-bottom:1px solid var(--line);vertical-align:top}
    th{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);background:var(--panel-strong)}
    tr:last-child td{border-bottom:0}
    :is(a,button,input,select,textarea,summary):focus-visible{outline:3px solid rgba(79,70,229,.22);outline-offset:2px}
    @media (max-width:720px){.shell{padding:1rem .85rem 2.5rem}}
  `;
}

export function renderExplainabilityStyles() {
  return `
    .guide-grid,.advisor-grid,.insight-grid{display:grid;gap:1.25rem;min-width:0;max-width:100%}
    .guide-grid,.advisor-grid,.insight-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
    .guide-card,.advisor-card,.insight-card{padding:1.25rem;border-radius:1rem;border:1px solid rgba(23,48,42,.08);width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden}
    .guide-card{display:grid;gap:.8rem;align-content:start;background:rgba(255,255,255,.68);min-height:100%}
    .guide-card-head{display:flex;align-items:center;gap:.75rem}
    .guide-icon{display:inline-flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:.8rem;background:rgba(1,140,198,.1);border:1px solid rgba(1,140,198,.14);color:var(--accent);font-size:.8rem;font-weight:700;letter-spacing:.08em}
    .guide-card strong,.advisor-title,.insight-card strong{display:block;margin:0;font-size:1rem;line-height:1.25}
    .guide-card span,.advisor-text,.insight-card span{display:block;color:var(--muted);line-height:1.55;min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:break-word}
    .advisor-card{display:grid;gap:.9rem;align-content:start;background:rgba(255,255,255,.82);min-height:100%}
    .advisor-card-head{display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;align-items:flex-start}
    .advisor-chip{display:inline-flex;align-items:center;padding:.32rem .68rem;border-radius:999px;border:1px solid rgba(23,48,42,.1);background:rgba(255,255,255,.7);font-size:.78rem;font-weight:700;text-transform:capitalize}
    .advisor-card .meta-list{margin-top:.1rem;display:grid;gap:.45rem}
    .advisor-stat{color:var(--ink);font-weight:600}
    .insight-card{background:rgba(255,255,255,.82)}
    .advisor-chip.high{background:rgba(24,115,76,.12);color:#18734c}
    .advisor-chip.medium{background:rgba(1,140,198,.1);color:#018CC6}
    .advisor-chip.low{background:rgba(183,142,65,.12);color:#8b6914}
    .empty-explainer{padding:1rem 1.05rem;border-radius:1rem;border:1px dashed rgba(23,48,42,.14);background:rgba(255,255,255,.62);color:var(--muted);line-height:1.55}
    @media (max-width:900px){.guide-grid,.advisor-grid,.insight-grid{grid-template-columns:1fr}}
  `;
}

export function renderAppShellStyles() {
  return `
    .app-header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.9rem 1.1rem;padding:.72rem .85rem;margin-bottom:1.35rem;background:var(--panel);border:1px solid var(--line);border-radius:.8rem;box-shadow:0 1px 2px rgba(15,15,25,.04);position:sticky;top:.75rem;z-index:40}
    .app-brand{display:flex;align-items:center}.app-brand img{display:block;width:154px;height:auto;max-height:42px;object-fit:contain}
    .app-nav{display:flex;gap:.25rem;flex-wrap:wrap;align-items:center;justify-content:center}
    .app-nav-link{display:inline-flex;align-items:center;justify-content:center;min-height:2rem;padding:.38rem .68rem;border-radius:.42rem;border:1px solid transparent;background:transparent;color:var(--muted);text-decoration:none;font-size:.82rem;font-weight:500;transition:background 120ms ease,color 120ms ease,border-color 120ms ease}
    .app-nav-link:hover{background:var(--panel-strong);color:var(--ink)}
    .app-nav-link.active{background:#eef2ff;border-color:#e0e7ff;color:var(--accent)}
    .app-search-hint{display:inline-flex;align-items:center;gap:.35rem;justify-self:end;min-height:2rem;padding:.36rem .7rem;border-radius:.42rem;border:1px solid var(--line);background:var(--panel-strong);color:var(--muted);font-size:.8rem;cursor:pointer}
    .app-search-hint kbd{font:inherit;font-size:.74rem;padding:.08rem .3rem;border-radius:.28rem;border:1px solid var(--line-strong);background:var(--panel);color:var(--ink)}
    @media (max-width:1100px){.app-header{grid-template-columns:1fr auto}.app-nav{grid-column:1 / -1;justify-content:flex-start}}
    @media (max-width:640px){.app-header{grid-template-columns:1fr;align-items:start;position:static}.app-nav,.app-search-hint{width:100%;justify-self:stretch}.app-nav-link{flex:1 1 8rem}.app-search-hint{justify-content:center}}
  `;
}

export function renderAppHeader(activeKey) {
  return `<header class="app-header">
    <a class="app-brand" href="/admin" title="Just Flow Hub"><img src="/assets/just-flow-logo.png" alt="Just Flow Events &amp; Marketing"></a>
    <nav class="app-nav" aria-label="Primary">
      ${NAV_ITEMS.map((item) => renderNavItem(item, activeKey)).join("")}
    </nav>
    <button type="button" class="app-search-hint" id="app-search-hint" title="Search (Ctrl/Cmd+K)">
      Search <kbd>Ctrl</kbd><kbd>K</kbd>
    </button>
  </header><script>window.JFAdvisorWidgetContext=window.JFAdvisorWidgetContext||${JSON.stringify({ page: activeKey || "app" })};</script>`;
}

export function renderJustFlowShellStyles() {
  return `
    :root{--bg:#fafaf9;--surface:#fff;--surface-2:#f5f5f4;--surface-3:#efeeec;--border:#e7e5e4;--border-strong:#d6d3d1;--text:#18181b;--text-2:#52525b;--text-3:#a1a1aa;--accent:#4f46e5;--accent-2:#f59e0b;--accent-soft:#eef2ff;--accent-2-soft:#fef3c7;--pos:#15803d;--neg:#b91c1c;--pos-soft:#dcfce7;--neg-soft:#fee2e2;--warn:#b45309;--warn-soft:#fef3c7;--shadow-sm:0 1px 2px rgba(15,15,25,.04);--shadow-md:0 4px 12px -2px rgba(15,15,25,.06),0 1px 2px rgba(15,15,25,.04);--shadow-lg:0 12px 32px -8px rgba(15,15,25,.12),0 4px 8px -2px rgba(15,15,25,.06);--radius-sm:6px;--radius:8px;--radius-lg:12px;--row-h:44px;--pad-y:14px;--pad-x:16px;--font-ui:14px;--font-num:14px}
    [data-theme=dark]{--bg:#09090b;--surface:#111114;--surface-2:#16161a;--surface-3:#1c1c21;--border:#26262c;--border-strong:#36363e;--text:#f4f4f5;--text-2:#a1a1aa;--text-3:#52525b;--accent:#818cf8;--accent-2:#fbbf24;--accent-soft:#1e1b4b;--accent-2-soft:#422c0c;--pos:#4ade80;--neg:#f87171;--pos-soft:#052e16;--neg-soft:#450a0a;--warn:#fbbf24;--warn-soft:#422c0c;--shadow-sm:0 1px 2px rgba(0,0,0,.4);--shadow-md:0 4px 12px -2px rgba(0,0,0,.4),0 1px 2px rgba(0,0,0,.3);--shadow-lg:0 12px 32px -8px rgba(0,0,0,.5),0 4px 8px -2px rgba(0,0,0,.3)}
    [data-density=compact]{--row-h:34px;--pad-y:8px;--pad-x:12px;--font-ui:13px;--font-num:13px}
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:var(--font-ui);line-height:1.5;-webkit-font-smoothing:antialiased;transition:background .2s ease,color .2s ease}.num{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
    .app,.jf-app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}.main,.jf-main{display:flex;flex-direction:column;min-width:0}
    .sidebar,.jf-sidebar{background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh}.brand,.jf-brand{padding:8px 18px;display:flex;align-items:center;border-bottom:1px solid var(--border);height:72px;background:#fff}.brand-logo{display:block;width:100%;max-width:194px;height:auto;max-height:54px;object-fit:contain}
    .nav,.jf-nav{padding:12px 10px;flex:1;overflow-y:auto}.nav-section{margin-bottom:16px}.nav-label,.jf-nav-label{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;padding:8px 12px}.nav-item,.jf-nav-item{display:flex;align-items:center;gap:10px;padding:7px 12px;border-radius:var(--radius-sm);color:var(--text-2);cursor:pointer;font-weight:500;font-size:13.5px;text-decoration:none;transition:background .12s,color .12s}.nav-item:hover,.jf-nav-item:hover{background:var(--surface-2);color:var(--text)}.nav-item.active,.jf-nav-item.active{background:var(--accent-soft);color:var(--accent)}[data-theme=dark] .nav-item.active,[data-theme=dark] .jf-nav-item.active{color:#c7d2fe}.nav-item svg,.jf-nav-item svg{width:16px;height:16px;flex-shrink:0}.nav-badge,.jf-nav-item em{margin-left:auto;font-size:11px;padding:1px 6px;background:var(--surface-3);border-radius:4px;font-style:normal}
    .sidebar-footer,.jf-user{padding:12px;border-top:1px solid var(--border)}.user-card,.jf-user{display:flex;align-items:center;gap:10px;border-radius:var(--radius-sm)}.user-card{padding:8px;cursor:pointer}.user-card:hover{background:var(--surface-2)}.avatar,.jf-user>span{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#ef4444);display:grid;place-items:center;color:#fff;font-weight:600;font-size:12px;flex-shrink:0}.user-name,.jf-user strong{font-size:13px;font-weight:500;display:block}.user-email,.jf-user small{font-size:11px;color:var(--text-3);display:block}
    .topbar,.jf-topbar{height:60px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;padding:0 24px;gap:16px;position:sticky;top:0;z-index:30}.breadcrumb,.jf-breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-2)}.breadcrumb b,.breadcrumb strong,.jf-breadcrumb strong{color:var(--text);font-weight:600}.breadcrumb-sep,.jf-breadcrumb b{color:var(--text-3)}.topbar-actions,.jf-top-actions{margin-left:auto;display:flex;align-items:center;gap:8px}
    .focus-search,.jf-search{height:32px;width:280px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-2);font:inherit;font-size:13px;display:flex;align-items:center;gap:8px;margin-left:auto;text-align:left}.focus-search:focus{outline:none;border-color:var(--accent);background:var(--surface)}
    .icon-btn,.jf-top-actions button{width:32px;height:32px;display:grid;place-items:center;border-radius:var(--radius-sm);border:1px solid transparent;background:transparent;color:var(--text-2);cursor:pointer;transition:all .12s}.icon-btn:hover,.jf-top-actions button:hover{background:var(--surface-2);color:var(--text)}.icon-btn svg,.jf-top-actions svg{width:16px;height:16px}
    .btn,.jf-btn{height:32px;padding:0 12px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font:inherit;font-weight:500;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .12s;white-space:nowrap}.btn:hover,.jf-btn:hover{background:var(--surface-2);border-color:var(--text-3)}.btn svg,.jf-btn svg{width:14px;height:14px}.btn-primary,.jf-btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn-primary:hover,.jf-btn-primary:hover{background:var(--accent);filter:brightness(1.1)}.btn-ghost{border-color:transparent}.btn-ghost:hover{background:var(--surface-2)}
    .page,.jf-page{padding:28px 32px;max-width:1600px}.page-header,.jf-page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:24px}.page-title-block h1,.jf-page-header h1{font-size:24px;font-weight:600;letter-spacing:-.02em;margin:0 0 4px;line-height:1.2}.page-title-block .subtitle,.jf-page-header p{color:var(--text-2);font-size:13.5px;margin:0}.page-actions,.jf-page-actions{display:flex;gap:8px;flex-shrink:0}
    .views-bar,.jf-tabs{display:flex;align-items:center;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--border)}.view-tab,.jf-tabs button{padding:9px 14px;font-size:13px;font-weight:500;color:var(--text-2);cursor:pointer;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:6px;background:transparent;font:inherit;text-decoration:none}.view-tab:hover,.jf-tabs button:hover{color:var(--text)}.view-tab.active,.jf-tabs button.active{color:var(--text);border-bottom-color:var(--accent)}.view-tab .dot,.jf-tabs i{width:6px;height:6px;border-radius:50%;background:var(--accent)}.view-tab.active .dot,.jf-tabs button.active i{background:var(--accent-2)}.tabcount{font-size:11px;padding:1px 6px;background:var(--surface-2);border-radius:4px;color:var(--text-3);font-weight:500}.view-tab.active .tabcount{background:var(--accent-soft);color:var(--accent)}
    .card,.chart-card,.table-card,.jf-chart-card,.jf-table-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm);overflow:hidden}.card-header{padding:14px 18px 0;display:flex;align-items:center;justify-content:space-between;gap:8px}.card-header h3{margin:0;font-size:14px;font-weight:600;letter-spacing:-.005em}.card-header .meta{font-size:12px;color:var(--text-3);margin-top:2px}.card-header a.link,.link{font-size:12.5px;color:var(--accent);text-decoration:none;font-weight:500}.card-header a.link:hover,.link:hover{text-decoration:underline}.card-body{padding:14px 18px 18px}.card-body.tight{padding:12px 14px 14px}
    .kpi-grid,.jf-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}.kpi,.jf-kpi{text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;position:relative;overflow:hidden;cursor:pointer;transition:all .15s;color:var(--text);text-decoration:none}.kpi:hover,.jf-kpi:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md)}.kpi.active,.jf-kpi.active{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.kpi-label,.jf-kpi-label{font-size:11.5px;color:var(--text-2);font-weight:500;display:flex;align-items:center;gap:6px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}.kpi-value,.jf-kpi strong{font-size:24px;font-weight:600;letter-spacing:-.02em;line-height:1.1}.kpi.zero .kpi-value,.kpi-value.muted{color:var(--text-3)}.kpi-sub{font-size:11.5px;color:var(--text-3);margin-top:4px}
    .summary-banner{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 18px;margin-bottom:20px;box-shadow:var(--shadow-sm);display:flex;align-items:center;gap:16px}.summary-banner .icon-bubble{width:32px;height:32px;border-radius:8px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex-shrink:0}.summary-text{font-size:13.5px;color:var(--text-2);line-height:1.45}.summary-text b{color:var(--text);font-weight:600}.delta-inline.pos{color:var(--pos);font-weight:600}.delta-inline.neg{color:var(--neg);font-weight:600}.summary-banner .right{margin-left:auto;display:flex;gap:8px;align-items:center}.site-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12.5px;color:var(--text-2);white-space:nowrap}.site-pill .dot{width:6px;height:6px;border-radius:50%;background:var(--pos)}.site-pill b{color:var(--text);font-weight:600}
    .dash-grid{display:grid;grid-template-columns:1fr 340px;gap:20px}.col-stack,.rail{display:flex;flex-direction:column;gap:16px}.section-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.section-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}.guide-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.guide-item{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.guide-item .step{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}.guide-item .step-num{width:16px;height:16px;border-radius:4px;background:var(--accent-soft);display:grid;place-items:center;font-size:10.5px}.guide-item .gh{font-size:13px;font-weight:600;margin-bottom:3px}.guide-item .gp{font-size:12.5px;color:var(--text-2);line-height:1.45}
    .advisor{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}[data-theme=dark] .advisor{box-shadow:0 0 0 3px rgba(129,140,248,.15)}.advisor .ah{display:flex;align-items:center;gap:8px}.advisor .badge{font-size:10.5px;padding:2px 6px;background:var(--accent);color:#fff;border-radius:4px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.advisor .quote{font-size:13.5px;color:var(--text-2);margin:10px 0 12px;line-height:1.55}.advisor .insight-row{display:flex;align-items:flex-start;gap:10px;background:var(--accent-soft);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:10px}.advisor .insight-row.action{background:var(--accent-2-soft)}.advisor .insight-row .label{font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}.advisor .insight-row.action .label{color:var(--accent-2)}.advisor .insight-row .body{font-size:13px;color:var(--text);line-height:1.5}.conf-pill{margin-left:auto;font-size:11px;padding:3px 8px;background:var(--pos-soft);color:var(--pos);border-radius:4px;font-weight:600;flex-shrink:0}.advisor .stats{display:flex;gap:18px;font-size:12.5px;color:var(--text-2);margin-top:6px}.advisor .stats b{color:var(--text);font-weight:600}
    .funnel-row{display:grid;grid-template-columns:80px 1fr 60px 50px;gap:10px;align-items:center;font-size:13px;padding:6px 0}.funnel-row .label{font-weight:500}.funnel-bar{height:8px;background:var(--surface-3);border-radius:4px;overflow:hidden}.funnel-bar .fill{height:100%;background:var(--accent);border-radius:4px;transition:width .4s}.funnel-row .count{text-align:right;font-size:12.5px;color:var(--text-2)}.funnel-row .pct{text-align:right;font-size:12px;color:var(--text-3);font-weight:500}.funnel-row.lvl-1 .fill{background:#6366f1}.funnel-row.lvl-2 .fill{background:#8b5cf6}.funnel-row.lvl-3 .fill{background:#a855f7}.funnel-row.lvl-4 .fill{background:#d946ef}.funnel-row.lvl-5 .fill{background:#ec4899}
    .mix-row{display:grid;grid-template-columns:minmax(72px,90px) 1fr 50px;gap:10px;align-items:center;font-size:13px;padding:5px 0}.mix-row .name{font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis}.mix-bar{height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden}.mix-bar .fill{height:100%;background:var(--accent);border-radius:3px}.mix-row .v{text-align:right;font-size:12.5px;color:var(--text-2)}.behavior-row{display:grid;grid-template-columns:36px 1fr;gap:10px;padding:8px 0;align-items:center;font-size:13px;border-bottom:1px solid var(--border)}.behavior-row:last-child{border-bottom:none}.behavior-row .v{font-family:"IBM Plex Mono",monospace;font-weight:600;color:var(--text);font-size:14px}.behavior-row .l{color:var(--text-2)}
    .trend-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.trend-card{padding:14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2)}.trend-card .th{font-size:12.5px;font-weight:600;margin-bottom:6px}.trend-card .empty-h{font-size:13px;font-weight:500;color:var(--text-2);margin-bottom:6px}.trend-card .empty-p{font-size:12px;color:var(--text-3);line-height:1.45}.trend-card svg{display:block;margin:4px 0 8px}.rail .card-body{padding:12px 16px 16px}.qi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.qi-tile{padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.qi-tile .v{font-family:"IBM Plex Mono",monospace;font-size:18px;font-weight:600;line-height:1.1;letter-spacing:-.01em}.qi-tile .v.muted{color:var(--text-3)}.qi-tile .l{font-size:11px;color:var(--text-3);margin-top:3px;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
    .alert-row{padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);display:flex;align-items:flex-start;gap:10px;font-size:12.5px;color:var(--text-2);margin-bottom:8px}.alert-row.warn{border-color:var(--warn);background:var(--warn-soft)}.alert-row.warn .body,.alert-row.warn .title{color:var(--warn)}.alert-row.ok{border-color:var(--pos);background:var(--pos-soft)}.alert-row.ok .title{color:var(--pos);font-weight:600}.alert-row .title{font-weight:600;color:var(--text);margin-bottom:2px;font-size:12.5px}.alert-row .body{font-size:12px;line-height:1.45}.alert-row svg{flex-shrink:0;margin-top:1px}.alert-row:last-child{margin-bottom:0}.lead-row{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px;border-bottom:1px solid var(--border)}.lead-row:last-child{border-bottom:none}.lead-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#ec4899);color:#fff;display:grid;place-items:center;font-weight:600;font-size:11px;flex-shrink:0}.lead-row .name{font-weight:500}.lead-row .when{font-size:11.5px;color:var(--text-3)}.lead-list{padding:0;margin:0 0 8px;list-style:none}.lead-list li{font-size:13px;color:var(--text-2);padding:6px 0;display:flex;align-items:flex-start;gap:8px}.lead-list li:before{content:"";width:5px;height:5px;border-radius:50%;background:var(--accent);margin-top:7px;flex-shrink:0}.info-block{padding:12px 14px;border-radius:var(--radius-sm);background:var(--pos-soft);border:1px solid var(--pos)}[data-theme=dark] .info-block{background:rgba(74,222,128,.08)}.info-block .ih{font-size:12.5px;font-weight:600;color:var(--pos);margin-bottom:3px}.info-block .ib{font-size:12.5px;color:var(--text-2);line-height:1.45}.empty-block{padding:16px;border:1px dashed var(--border-strong);border-radius:var(--radius-sm);background:var(--surface-2);text-align:center}.empty-block .eh{font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px}.empty-block .ep{font-size:12px;color:var(--text-3);line-height:1.45}
    .es-grid{display:grid;grid-template-columns:1fr 340px;gap:20px}.control-bar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto auto;gap:10px;align-items:end;margin-bottom:20px;box-shadow:var(--shadow-sm)}.field{display:flex;flex-direction:column;gap:4px;min-width:0}.field label{font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em}.field input,.field select{height:32px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text);font:inherit;font-size:13px}.field input:focus,.field select:focus{outline:none;border-color:var(--accent);background:var(--surface)}.stats-inline{display:flex;gap:18px;font-size:12.5px;color:var(--text-2);padding-top:6px;border-top:1px solid var(--border);margin-top:10px}.stats-inline b{color:var(--text);font-weight:600}.lower-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.quality-row{padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px}.quality-row:last-child{border-bottom:none}.quality-row .qh{font-weight:600;font-size:13px}.quality-row .qp{color:var(--text-3);font-size:11.5px;margin-top:2px}.rel-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px}.rel-row:last-child{border-bottom:none}.rel-row .name{color:var(--text-2);min-width:0;overflow:hidden;text-overflow:ellipsis}.rel-row .v{font-family:"IBM Plex Mono",monospace;font-weight:600}.auto-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.auto-tile{padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.auto-tile .h{font-size:12.5px;font-weight:600;margin-bottom:6px}.auto-tile .b{font-size:12px;color:var(--text-2);line-height:1.45}table.data{width:100%;border-collapse:collapse;font-size:13px}.data thead th{text-align:left;font-size:11px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.04em;padding:10px 12px;background:var(--surface-2);border-bottom:1px solid var(--border)}.data thead th.num-col,.data tbody td.num-col{text-align:right}.data tbody tr{transition:background .08s;cursor:pointer}.data tbody tr:hover{background:var(--surface-2)}.data tbody td{padding:10px 12px;border-bottom:1px solid var(--border)}.data tbody tr:last-child td{border-bottom:none}
    svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:6px;border:2px solid var(--bg)}::-webkit-scrollbar-thumb:hover{background:var(--text-3)}:is(a,button,input,select,textarea):focus-visible{outline:3px solid rgba(79,70,229,.22);outline-offset:2px}
    @media (max-width:1200px){.dash-grid,.es-grid{grid-template-columns:1fr}.control-bar{grid-template-columns:repeat(4,minmax(0,1fr))}.control-bar .btn{justify-content:center}}@media(max-width:1100px){.kpi-grid,.jf-kpi-grid,.lower-grid{grid-template-columns:repeat(2,1fr)}.trend-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:900px){.section-row,.section-row-3,.guide-grid{grid-template-columns:1fr}.control-bar{grid-template-columns:1fr 1fr}}@media(max-width:768px){.app,.jf-app{grid-template-columns:1fr}.sidebar,.jf-sidebar{display:none}.page,.jf-page{padding:16px}.topbar,.jf-topbar{padding:0 12px}.focus-search,.jf-search{display:none}.page-header,.jf-page-header{display:block}.page-actions,.jf-page-actions{margin-top:14px;flex-wrap:wrap}.kpi-grid,.jf-kpi-grid,.lower-grid{grid-template-columns:1fr 1fr}.summary-banner{align-items:flex-start;flex-wrap:wrap}.summary-banner .right{margin-left:0}.trend-grid{grid-template-columns:1fr}}    @media(max-width:560px){.control-bar,.kpi-grid,.jf-kpi-grid,.lower-grid{grid-template-columns:1fr}}@media print{@page{size:letter;margin:.5in}.sidebar,.jf-sidebar,.topbar,.jf-topbar,.control-bar,.page-actions,.theme-toggle,.jf-tweaks,.jf-export-menu{display:none!important}.app,.jf-app{display:block}.page,.jf-page{padding:0;max-width:none}.es-grid,.dash-grid{display:block}.rail{margin-top:16px}.card,.table-card,.info-block{break-inside:avoid;box-shadow:none}.card{margin-bottom:12px}body{background:#fff;color:#111}}
    .jf-export-menu{position:relative;display:inline-block}.jf-export-menu>summary{list-style:none;cursor:pointer}.jf-export-menu>summary::-webkit-details-marker{display:none}.jf-export-panel{position:absolute;right:0;top:calc(100% + 6px);min-width:180px;padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);z-index:50;display:grid;gap:2px}.jf-export-item{display:block;padding:8px 10px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:13px;font-weight:500}.jf-export-item:hover{background:var(--surface-2)}`;
}

const DEFAULT_EXPORT_FILTER_KEYS = [
  "client_id",
  "website_id",
  "date_from",
  "date_to",
  "model",
  "lead_attribution_model",
  "lead_status",
  "lead_quality",
  "lead_type",
  "owner_user_name"
];

export function buildExportQueryString(filters = {}, options = {}) {
  const keys = options.keys ?? DEFAULT_EXPORT_FILTER_KEYS;
  const params = new URLSearchParams();
  keys.forEach((key) => {
    const value = filters?.[key];
    if (value === null || value === undefined || value === "") {
      return;
    }
    params.set(key, String(value));
  });
  return params.toString();
}

export function renderExportPresetsDropdown(filters = {}, options = {}) {
  const query = buildExportQueryString(filters, options);
  const suffix = query ? `?${query}` : "";
  const presets = options.presets ?? [
    { label: "Channels", href: "/admin/exports/channels.csv" },
    { label: "Orders", href: "/admin/exports/orders.csv" },
    { label: "Leads", href: "/admin/exports/leads.csv" },
    { label: "Custom events", href: "/admin/exports/custom-events.csv" }
  ];
  const items = presets.map((preset) => (
    `<a class="jf-export-item" href="${escapeGuide(preset.href)}${suffix}">${escapeGuide(preset.label)}</a>`
  )).join("");
  const label = escapeGuide(options.label ?? "Export CSV");
  return `<details class="jf-export-menu"><summary class="btn jf-export-trigger">${renderIcon("download")} ${label}</summary><div class="jf-export-panel">${items}</div></details>`;
}

export function renderJustFlowSidebar(activeKey = "dashboard", { standaloneUtm = false, user = null } = {}) {
  const isAdmin = user?.role === "admin";
  const sections = standaloneUtm ? [
    {
      label: "UTM Builder",
      items: [
        { key: "builder", href: "/new", label: "New Link", icon: "message" },
        { key: "library", href: "/utms", label: "Link Library", icon: "link" },
        { key: "imports", href: "/imports", label: "Import CSV", icon: "download" },
        ...(isAdmin ? [
          { key: "standards", href: "/standards", label: "Campaign Standards", icon: "bookmark" },
          { key: "users", href: "/users", label: "Users", icon: "users" }
        ] : [])
      ]
    }
  ] : [
    {
      label: "Workspace",
      items: [
        { key: "dashboard", href: "/admin", label: "Dashboard", icon: "home" },
        { key: "executive-summary", href: "/admin/executive-summary", label: "Executive Summary", icon: "file" },
        { key: "reports", href: "/admin/reports", label: "Reports", icon: "chart" },
        { key: "custom-events", href: "/admin/reports/custom-events", label: "Custom Events", icon: "chart" },
        { key: "behavior", href: "/admin/reports/behavior", label: "Behavior", icon: "chart" },
        { key: "leads", href: "/admin/leads", label: "Leads", icon: "users" },
        { key: "library", href: "/utms", label: "Link Library", icon: "link" },
        { key: "link-performance", href: "/admin/link-performance", label: "Link Results", icon: "video" },
        { key: "snapshots", href: "/admin/snapshot", label: "Snapshots", icon: "trend" },
        { key: "sales", href: "/admin/sales", label: "Sales", icon: "chart" },
        { key: "profiles", href: "/admin/profiles", label: "Profile Journeys", icon: "users" }
      ]
    },
    {
      label: "Tools",
      items: [
        { key: "offline-conversions", href: "/admin/offline-conversions", label: "Offline data", icon: "grid" },
        { key: "websites", href: "/admin/websites", label: "Sites", icon: "pulse" },
        { key: "imports", href: "/imports", label: "Import Links", icon: "download" },
        { key: "builder", href: "/new", label: "URL Builder", icon: "message" }
      ]
    },
    {
      label: "Account",
      items: [
        { key: "settings", href: "/admin/websites", label: "Settings", icon: "settings" }
      ]
    }
  ];
  return `<aside class="sidebar">
    <a class="brand" href="/new" aria-label="Just Flow UTM Builder"><img class="brand-logo" src="/assets/just-flow-logo.png" alt="Just Flow Events &amp; Marketing"></a>
    <nav class="nav" aria-label="Primary">
      ${sections.map((section) => `<div class="nav-section"><div class="nav-label">${section.label}</div>${section.items.map((item) => renderJustFlowNavItem(item, activeKey)).join("")}</div>`).join("")}
    </nav>
    ${renderSidebarUserFooter(user, activeKey)}
  </aside>`;
}

function renderSidebarUserFooter(user, activeKey) {
  if (!user) {
    return "";
  }
  const roleLabel = user.role === "admin" ? "Administrator" : "Member";
  return `<div class="sidebar-footer">
    <a class="user-card${activeKey === "account" ? " active" : ""}" href="/account" title="My account">
      <div class="avatar">${escapeGuide(initialsFor(user.displayName))}</div>
      <div style="min-width:0"><span class="user-name">${escapeGuide(user.displayName)}</span><span class="user-email">${escapeGuide(roleLabel)}</span></div>
    </a>
    <form method="post" action="/logout" style="margin-top:8px"><button class="btn" type="submit" style="width:100%">Sign out</button></form>
  </div>`;
}

function initialsFor(name) {
  const parts = String(name ?? "").trim().split(/\s+/u).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

export function renderJustFlowTopbar({ section = "Workspace", title = "Dashboard", searchPlaceholder = "Search reports, sources, campaigns...", showSearch = true } = {}) {
  return `<header class="topbar">
    <div class="breadcrumb">${escapeGuide(section)} <span class="breadcrumb-sep">/</span> <b>${escapeGuide(title)}</b></div>
    ${showSearch ? `<button type="button" class="focus-search" id="app-search-hint">${renderIcon("search")} ${escapeGuide(searchPlaceholder)}</button>` : ""}
  </header>`;
}

export function renderJustFlowThemeScript() {
  return `<script>
    (function(){
      const body=document.body;
      body.dataset.theme=localStorage.getItem("jf-theme")||body.dataset.theme||"light";
      body.dataset.density=localStorage.getItem("jf-density")||body.dataset.density||"comfortable";
    })();
  </script>`;
}

export function renderIcon(name) {
  const paths = {
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-4 3 3 5-7"/>',
    funnel: '<path d="M3 5h18l-7 8v5l-4 2v-7z"/>',
    users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M14 19c0-2 1.5-3.5 3.5-3.5S21 17 21 19"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    megaphone: '<path d="m3 11 18-5v12L3 13z"/><path d="M11 14v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    bookmark: '<path d="M19 21 12 17 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0 1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0 1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0 0 20.5 15"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
    file: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h4"/>',
    trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    sparkle: '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>',
    grid: '<path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? ""}</svg>`;
}

function renderJustFlowNavItem(item, activeKey) {
  const isActive = item.key === activeKey;
  return `<a class="nav-item${isActive ? " active" : ""}" href="${item.href}"${isActive ? ' aria-current="page"' : ""}>${renderIcon(item.icon)}<span>${escapeGuide(item.label)}</span>${item.badge ? `<span class="nav-badge">${escapeGuide(item.badge)}</span>` : ""}</a>`;
}

export function renderScopedWebsiteFilterScript(configs = []) {
  const normalizedConfigs = (Array.isArray(configs) ? configs : [])
    .filter((config) => config?.clientSelectId && config?.websiteSelectId)
    .map((config) => ({
      clientSelectId: String(config.clientSelectId),
      websiteSelectId: String(config.websiteSelectId)
    }));
  if (!normalizedConfigs.length) {
    return "";
  }
  return `<script>
    (function(){
      const configs=${JSON.stringify(normalizedConfigs)};
      configs.forEach(function(config){
        const clientSelect=document.getElementById(config.clientSelectId);
        const websiteSelect=document.getElementById(config.websiteSelectId);
        if(!clientSelect||!websiteSelect){return}
        const websiteOptions=Array.from(websiteSelect.querySelectorAll("option[data-client-id]")).map(function(option){
          return {
            value:option.value,
            label:option.textContent||"",
            clientId:option.getAttribute("data-client-id")||""
          };
        });
        const defaultLabel=websiteSelect.querySelector('option[value=""]')?.textContent||"All selected client websites";
        function syncWebsiteOptions(){
          const clientId=clientSelect.value||"";
          const currentWebsiteId=websiteSelect.value||"";
          const matchingOptions=websiteOptions.filter(function(option){
            return !clientId||option.clientId===clientId;
          });
          const shouldKeepSelection=matchingOptions.some(function(option){
            return option.value===currentWebsiteId;
          });
          websiteSelect.innerHTML="";
          const placeholder=document.createElement("option");
          placeholder.value="";
          placeholder.textContent=defaultLabel;
          websiteSelect.appendChild(placeholder);
          matchingOptions.forEach(function(option){
            const nextOption=document.createElement("option");
            nextOption.value=option.value;
            nextOption.textContent=option.label;
            nextOption.setAttribute("data-client-id",option.clientId);
            if(shouldKeepSelection&&option.value===currentWebsiteId){
              nextOption.selected=true;
            }
            websiteSelect.appendChild(nextOption);
          });
          if(!shouldKeepSelection){
            websiteSelect.value="";
          }
        }
        clientSelect.addEventListener("change",syncWebsiteOptions);
        syncWebsiteOptions();
      });
    })();
  </script>`;
}

export function renderInsightBlocks({ whatChanged, whatShouldDo }) {
  return `<section class="panel">
    <div class="insight-grid">
      <div class="insight-card"><strong>What changed?</strong><span>${escapeGuide(whatChanged)}</span></div>
      <div class="insight-card"><strong>What should I do?</strong><span>${escapeGuide(whatShouldDo)}</span></div>
    </div>
  </section>`;
}

export function renderAdvisorPanel(advisor) {
  const recommendations = Array.isArray(advisor?.recommendations) ? advisor.recommendations : [];
  if (!recommendations.length) {
    return `<section class="panel"><h2>Advisor</h2><div class="empty-explainer" style="margin-top:.8rem">No strong recommendation yet. Keep collecting data or widen the date range so the app has enough evidence to advise confidently.</div></section>`;
  }

  const narrative = advisor?.summary
    ? `<p class="lede" style="margin-top:.4rem">${escapeGuide(advisor.summary)}</p>`
    : "";

  return `<section class="panel">
    <h2>Advisor</h2>
    ${narrative}
    <div class="advisor-grid" style="margin-top:.8rem">
      ${recommendations.map((recommendation) => `<div class="advisor-card">
        <div class="advisor-card-head">
          <strong class="advisor-title">${escapeGuide(recommendation.title)}</strong>
          <span class="advisor-chip ${escapeGuide(recommendation.confidence || "low")}">${escapeGuide(recommendation.confidence || "low")} confidence</span>
        </div>
        <span class="advisor-text">${escapeGuide(recommendation.rationale)}</span>
        <div class="meta-list">
          <span><strong style="display:inline;margin:0">Action:</strong> ${escapeGuide(recommendation.action)}</span>
          ${(recommendation.evidence || []).map((item) => `<span class="advisor-stat">${escapeGuide(item)}</span>`).join("")}
        </div>
      </div>`).join("")}
    </div>
  </section>`;
}

export function renderExplainedEmptyState({ title, reason, nextStep }) {
  return `<div class="empty-explainer"><strong style="display:block;margin-bottom:.3rem">${escapeGuide(title)}</strong><span>${escapeGuide(reason)}</span><span style="margin-top:.45rem">${escapeGuide(nextStep)}</span></div>`;
}

export function humanizeTokenLabel(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "--";
  }

  const known = {
    new: "New",
    reviewed: "Reviewed",
    qualified: "Qualified",
    unqualified: "Unqualified",
    contacted: "Contacted",
    opportunity: "Opportunity",
    won: "Won",
    lost: "Lost",
    spam: "Spam",
    duplicate: "Duplicate",
    unreviewed: "Unreviewed",
    high: "High",
    medium: "Medium",
    low: "Low",
    residential: "Residential",
    commercial: "Commercial",
    existing_customer: "Existing Customer",
    new_customer: "New Customer",
    other: "Other"
  };
  if (known[normalized]) {
    return known[normalized];
  }
  return normalized
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\b\w/gu, (char) => char.toUpperCase());
}

function renderNavItem(item, activeKey) {
  const isActive = item.key === activeKey;
  return `<a class="app-nav-link${isActive ? " active" : ""}" href="${item.href}"${isActive ? ' aria-current="page"' : ""}>${item.label}</a>`;
}

export function renderLoadingStyles() {
  return `.btn-loading{position:relative;pointer-events:none}.btn-loading .btn-loading-text{visibility:hidden}.btn-loading::after{content:"";position:absolute;inset:0;margin:auto;width:1.1em;height:1.1em;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
}

export function renderToastStyles() {
  return `.toast{position:fixed;right:1rem;bottom:1rem;max-width:22rem;padding:.85rem 1rem;border-radius:1rem;background:rgba(23,48,42,.94);color:#fff;box-shadow:0 18px 36px rgba(23,48,42,.28);opacity:0;pointer-events:none;transform:translateY(12px);transition:opacity 140ms ease,transform 140ms ease;z-index:9999}.toast.warning{background:rgba(154,103,8,.96)}.toast.error{background:rgba(180,67,43,.96)}.toast.visible{opacity:1;transform:translateY(0)}`;
}

export function renderToastHtml() {
  return `<div class="toast" id="app-toast" aria-live="polite"></div>`;
}

export function renderBreadcrumbs(items) {
  if (!items || items.length === 0) return "";
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, i) => {
    const isLast = i === items.length - 1;
    const link = item.href && !isLast ? `<a href="${item.href}">${item.label}</a>` : `<span${isLast ? ' class="current"' : ""}>${item.label}</span>`;
    return link + (i < items.length - 1 ? '<span class="breadcrumb-sep" aria-hidden="true">›</span>' : "");
  }).join("")}</nav>`;
}

export function renderBreadcrumbStyles() {
  return `.breadcrumbs{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem;font-size:.88rem;color:var(--muted);margin-bottom:.65rem}.breadcrumbs a{color:var(--accent);text-decoration:none}.breadcrumbs a:hover{text-decoration:underline}.breadcrumbs .current{color:var(--ink);font-weight:600}.breadcrumb-sep{opacity:.6}`;
}

export function renderGlobalSearchOverlay() {
  return `<div id="global-search-overlay" class="global-search-overlay" hidden aria-label="Search">
  <div class="global-search-backdrop" data-close-search></div>
  <div class="global-search-modal">
    <input type="search" id="global-search-input" class="global-search-input" placeholder="Search leads, links..." autocomplete="off" aria-label="Search query">
    <div id="global-search-results" class="global-search-results"></div>
  </div>
</div>`;
}

export function renderAdvisorAssistantWorkspace(options = {}) {
  if (!GENIE_ENABLED) {
    return "";
  }

  const hideModeSelector = Boolean(options.hideModeSelector);
  const slimToolbar = Boolean(options.slimToolbar);
  const fullPage = Boolean(options.fullPage);
  const inputPlaceholder = String(options.inputPlaceholder ?? "Ask what changed, what to do, or what this page means...");
  const sectionClasses = [
    "advisor-assistant",
    "advisor-assistant-standalone",
    slimToolbar ? "advisor-assistant-slim" : "",
    fullPage ? "advisor-assistant-fullpage" : ""
  ].filter(Boolean).join(" ");
  return `<section id="advisor-assistant" class="${sectionClasses}" data-standalone="true">
  <div id="advisor-assistant-panel" class="advisor-assistant-panel" aria-label="Just Flow Genie">
    <div class="advisor-assistant-head">
      <div>
        <strong>Just Flow Genie</strong>
        <span id="advisor-assistant-status">The data is the source of truth. I explain what it means.</span>
      </div>
      <button type="button" class="advisor-assistant-close" data-close-advisor aria-label="Close assistant" onclick="window.__jfCloseAdvisor&&window.__jfCloseAdvisor();return false;">X</button>
    </div>
    <div class="advisor-assistant-toolbar">${hideModeSelector ? "" : `<label class="advisor-mode-label">Mode<select id="advisor-assistant-mode" class="advisor-mode-select"><option value="operator">Operator</option><option value="executive">Executive</option><option value="client">Client</option><option value="tracking">Tracking</option></select></label>`}<div class="advisor-toolbar-actions"><button type="button" id="advisor-assistant-export" class="advisor-assistant-mini">Copy Export</button><button type="button" id="advisor-assistant-action-plan" class="advisor-assistant-mini">Action Plan</button>${slimToolbar ? "" : `<button type="button" id="advisor-assistant-client-summary" class="advisor-assistant-mini">Client Summary</button><button type="button" id="advisor-assistant-monthly-update" class="advisor-assistant-mini">Monthly Update</button><button type="button" id="advisor-assistant-internal-brief" class="advisor-assistant-mini">Internal Brief</button><button type="button" id="advisor-assistant-exec-summary" class="advisor-assistant-mini">Exec Summary</button>`}</div></div>
    <div id="advisor-assistant-messages" class="advisor-assistant-messages"></div>
    <div id="advisor-assistant-quick" class="advisor-assistant-quick"></div>
    <form id="advisor-assistant-form" class="advisor-assistant-form">
      <input type="text" id="advisor-assistant-input" placeholder="${escapeGuide(inputPlaceholder)}" autocomplete="off">
      <button type="submit">Send</button>
    </form>
  </div>
</section>`;
}

export function renderGlobalSearchStyles() {
  return `.global-search-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:4rem 1rem 0}.global-search-overlay[hidden]{display:none!important}.global-search-backdrop{position:fixed;inset:0;background:rgba(23,48,42,.4);cursor:pointer}.global-search-modal{position:relative;width:100%;max-width:28rem;background:var(--panel, #fff);border-radius:1.2rem;box-shadow:0 24px 60px rgba(23,48,42,.2);overflow:hidden}.global-search-input{width:100%;padding:1rem 1.2rem;border:0;border-bottom:1px solid rgba(23,48,42,.1);font-size:1.1rem;background:transparent}.global-search-input:focus{outline:none}.global-search-results{max-height:18rem;overflow:auto}.global-search-results a{display:block;padding:.75rem 1.2rem;border-bottom:1px solid rgba(23,48,42,.06);color:var(--ink);text-decoration:none}.global-search-results a:hover{background:rgba(1,140,198,.08)}.global-search-results .section-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:.5rem 1.2rem;background:rgba(23,48,42,.04)}.advisor-assistant{position:relative;max-width:1560px;margin:0 auto 1.25rem;padding:0 1rem}.advisor-assistant-panel{display:grid;grid-template-rows:auto auto 1fr auto auto;background:rgba(255,250,242,.98);border:1px solid rgba(23,48,42,.1);border-radius:1.2rem;box-shadow:0 28px 70px rgba(20,32,31,.12);overflow:hidden}.advisor-assistant-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding:1rem 1rem .8rem;border-bottom:1px solid rgba(23,48,42,.08)}.advisor-assistant-head strong{display:block}.advisor-assistant-head span{display:block;color:var(--muted);font-size:.84rem;line-height:1.45;margin-top:.2rem}.advisor-assistant-close{border:0;background:transparent;font-size:1rem;font-weight:700;cursor:pointer;color:var(--muted)}.advisor-assistant-toolbar{display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;padding:.6rem 1rem;border-bottom:1px solid rgba(23,48,42,.08);background:rgba(255,255,255,.55)}.advisor-assistant-slim .advisor-assistant-toolbar{justify-content:flex-end}.advisor-toolbar-actions{display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end}.advisor-mode-label{display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:var(--muted)}.advisor-mode-select{width:auto;padding:.35rem .5rem;border-radius:.6rem}.advisor-assistant-mini{padding:.45rem .65rem;border-radius:.7rem;border:1px solid rgba(23,48,42,.1);background:#fff;cursor:pointer}.advisor-assistant-messages{padding:1rem;overflow:auto;display:grid;gap:.75rem;background:rgba(255,255,255,.45);max-height:28rem}.advisor-assistant-slim .advisor-assistant-messages{max-height:52rem}.advisor-assistant-fullpage{margin-bottom:0}.advisor-assistant-fullpage .advisor-assistant-panel{min-height:calc(100vh - 220px);grid-template-rows:auto auto 1fr auto auto}.advisor-assistant-fullpage .advisor-assistant-messages{max-height:none;min-height:20rem}.advisor-msg{max-width:92%;padding:.8rem .9rem;border-radius:1rem;line-height:1.5;font-size:.92rem}.advisor-msg.assistant{background:#fff;border:1px solid rgba(23,48,42,.08);justify-self:start}.advisor-msg.user{background:rgba(1,140,198,.12);border:1px solid rgba(1,140,198,.12);justify-self:end}.advisor-msg-text strong{font-weight:600}.advisor-msg-text p{margin:.4rem 0 0}.advisor-msg-text p:first-child{margin-top:0}.advisor-msg-text ul{margin:.35rem 0 0 1.1rem;padding:0}.advisor-msg-text li{margin:.2rem 0}.advisor-block{margin-top:.65rem;padding:.65rem .75rem;border-radius:.85rem;background:rgba(255,250,242,.85);border:1px solid rgba(23,48,42,.08)}.advisor-block strong{display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.3rem;color:var(--muted)}.advisor-block ul{margin:.2rem 0 0 1rem;padding:0}.advisor-block li{margin:.18rem 0}.advisor-evidence-links,.advisor-follow-up-links,.advisor-memory-actions,.advisor-nav-actions{display:flex;gap:.45rem;flex-wrap:wrap;margin-top:.55rem}.advisor-evidence-link,.advisor-follow-up-btn,.advisor-memory-btn{padding:.38rem .6rem;border-radius:999px;border:1px solid rgba(1,140,198,.18);background:rgba(1,140,198,.06);font-size:.78rem;cursor:pointer;color:var(--ink)}.advisor-nav-btn{display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .8rem;border-radius:.75rem;border:1px solid rgba(1,140,198,.22);background:rgba(1,140,198,.07);font-size:.82rem;color:var(--accent);text-decoration:none;cursor:pointer}.advisor-nav-btn:hover{background:rgba(1,140,198,.14)}.advisor-memory-btn{border-color:rgba(23,48,42,.12);background:#fff}.advisor-assistant-quick{display:flex;gap:.45rem;flex-wrap:wrap;padding:0 1rem .85rem}.advisor-quick-btn{padding:.45rem .7rem;border-radius:999px;border:1px solid rgba(23,48,42,.1);background:rgba(255,255,255,.75);font-size:.8rem;cursor:pointer}.advisor-assistant-form{display:grid;grid-template-columns:1fr auto;gap:.6rem;padding:0 1rem 1rem}.advisor-assistant-form input{padding:.8rem .9rem;border-radius:.9rem;border:1px solid rgba(23,48,42,.12);background:#fff}.advisor-assistant-form button{padding:.78rem .95rem;border-radius:.9rem;border:0;background:var(--accent);color:#fff;cursor:pointer}.advisor-disclaimer{font-size:.78rem;color:var(--muted)}.advisor-ask-btn{margin-left:.5rem;padding:.28rem .55rem;border-radius:999px;border:1px solid rgba(23,48,42,.1);background:#fff;font-size:.74rem;cursor:pointer}.advisor-evidence-hit{outline:3px solid rgba(1,140,198,.35);outline-offset:3px;transition:outline 160ms ease}.genie-command-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem;margin-bottom:.85rem}.genie-command-form{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}.genie-command-form select,.genie-command-form input[type=date]{width:auto;padding:.55rem .7rem;font-size:.88rem}.genie-command-form .button,.genie-command-form .link-button{min-height:2.2rem;padding:.5rem .85rem;font-size:.86rem}.genie-command-form a{font-size:.82rem;color:var(--accent);text-decoration:none}.genie-command-form a:hover{text-decoration:underline}.genie-stat-chips{display:flex;gap:.45rem;flex-wrap:wrap;align-items:center}.genie-stat-chip{display:inline-flex;align-items:center;padding:.3rem .65rem;border-radius:999px;border:1px solid rgba(23,48,42,.1);background:rgba(255,255,255,.7);font-size:.82rem}.genie-stat-chip--alert{background:rgba(166,72,51,.08);border-color:rgba(166,72,51,.18);color:#a64833}.genie-stat-chip--warn{background:rgba(183,142,65,.1);border-color:rgba(183,142,65,.2);color:#8b6914}.advisor-thinking{display:inline-flex;gap:.4rem;align-items:center;padding:.75rem 1rem;background:#fff;border:1px solid rgba(23,48,42,.08)}.advisor-thinking-dot{width:.48rem;height:.48rem;border-radius:50%;background:var(--muted,#66766f);animation:jf-pulse .9s ease-in-out infinite;display:inline-block}.advisor-thinking-dot:nth-child(2){animation-delay:.18s}.advisor-thinking-dot:nth-child(3){animation-delay:.36s}@keyframes jf-pulse{0%,100%{opacity:.25;transform:scale(.75)}50%{opacity:1;transform:scale(1)}}.advisor-evidence-chips{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.5rem}.advisor-evidence-chip{padding:.22rem .5rem;border-radius:999px;border:1px solid rgba(23,48,42,.1);background:rgba(255,255,255,.72);font-size:.75rem;color:var(--muted,#66766f)}.advisor-next-action{margin-top:.5rem}.advisor-assistant-form input:disabled,.advisor-assistant-form button:disabled,.advisor-quick-btn:disabled{opacity:.5;cursor:not-allowed}@media (max-width:640px){.advisor-assistant{padding:0 .85rem}.advisor-assistant-panel{width:100%}.advisor-assistant-form{grid-template-columns:1fr}.advisor-assistant-slim .advisor-assistant-toolbar{justify-content:flex-start}}`;
}

export function renderAdvisorAssistantBootstrap(context = {}) {
  if (!GENIE_ENABLED) {
    return "";
  }

  return `<script>window.JFAdvisorWidgetContext=Object.assign({},window.JFAdvisorWidgetContext||{},${JSON.stringify(context)});</script>`;
}

export function renderGlobalSearchScript() {
  return `<script>
(function(){
  const overlay=document.getElementById("global-search-overlay");
  const input=document.getElementById("global-search-input");
  const results=document.getElementById("global-search-results");
  const hint=document.getElementById("app-search-hint");
  let debounce=null;
  function show(){if(overlay){overlay.hidden=false;input?.focus();input.value=""}}
  function hide(){if(overlay)overlay.hidden=true}
  function render(data){
    if(!results)return;
    const items=[];
    if(data.leads&&data.leads.length)items.push('<div class="section-label">Leads</div>',...data.leads.map(l=>'<a href="'+l.url+'">'+escapeHtml(l.label||l.lead_uuid)+'</a>'));
    if(data.links&&data.links.length)items.push('<div class="section-label">Links</div>',...data.links.map(l=>'<a href="'+l.url+'">'+escapeHtml(l.label||"Link")+'</a>'));
    results.innerHTML=items.length?items.join(""):'<div class="section-label">No results</div>';
  }
  function escapeHtml(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}
  document.addEventListener("keydown",function(e){if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();show()}});
  hint?.addEventListener("click",show);
  overlay?.querySelector("[data-close-search]")?.addEventListener("click",hide);
  input?.addEventListener("input",function(){
    clearTimeout(debounce);
    const q=this.value.trim();
    if(q.length<2){render({leads:[],links:[]});return}
    debounce=setTimeout(function(){const v=(input&&input.value||"").trim();if(v.length>=2)fetch("/admin/search.json?q="+encodeURIComponent(v)).then(r=>r.json()).then(render).catch(function(){render({leads:[],links:[]})});else render({leads:[],links:[]})},150);
  });
  input?.addEventListener("keydown",function(e){if(e.key==="Escape")hide()});

  const advisorRoot=document.getElementById("advisor-assistant");
  const advisorToggle=document.getElementById("app-genie-tab")||document.getElementById("advisor-assistant-toggle");
  const advisorPanel=document.getElementById("advisor-assistant-panel");
  const advisorClose=document.querySelector("[data-close-advisor]");
  const advisorMessages=document.getElementById("advisor-assistant-messages");
  const advisorQuick=document.getElementById("advisor-assistant-quick");
  const advisorForm=document.getElementById("advisor-assistant-form");
  const advisorInput=document.getElementById("advisor-assistant-input");
  const advisorStatus=document.getElementById("advisor-assistant-status");
  const advisorMode=document.getElementById("advisor-assistant-mode");
  const advisorExport=document.getElementById("advisor-assistant-export");
  const advisorActionPlan=document.getElementById("advisor-assistant-action-plan");
  const advisorClientSummary=document.getElementById("advisor-assistant-client-summary");
  const advisorMonthlyUpdate=document.getElementById("advisor-assistant-monthly-update");
  const advisorInternalBrief=document.getElementById("advisor-assistant-internal-brief");
  const advisorExecSummary=document.getElementById("advisor-assistant-exec-summary");
  const advisorState={messages:[],context:Object.assign({page:"app"},window.JFAdvisorWidgetContext||{},buildCurrentFilterContext())};
  const advisorStorageKeys=getAdvisorStorageKeys(advisorState.context);
  hydrateAdvisorState();
  let isSending=false;
  function addThinkingBubble(){if(!advisorMessages)return;var existing=document.getElementById("advisor-thinking-bubble");if(existing)return;var div=document.createElement("div");div.id="advisor-thinking-bubble";div.className="advisor-msg assistant advisor-thinking";for(var i=0;i<3;i++){var dot=document.createElement("span");dot.className="advisor-thinking-dot";div.appendChild(dot)}advisorMessages.appendChild(div);advisorMessages.scrollTop=advisorMessages.scrollHeight}
  function removeThinkingBubble(){var el=document.getElementById("advisor-thinking-bubble");if(el)el.remove()}
  function setInputLocked(locked){if(advisorInput)advisorInput.disabled=locked;var btn=advisorForm&&advisorForm.querySelector("button[type=submit]");if(btn)btn.disabled=locked;if(advisorQuick)advisorQuick.querySelectorAll(".advisor-quick-btn").forEach(function(b){b.disabled=locked})}
  function formatAgentText(text){var safe=normalizeAgentNewlines(escapeHtml(String(text||"")));var blocks=safe.split("\\n\\n").map(function(block){return block.trim()}).filter(Boolean);if(!blocks.length)return"";return blocks.map(function(block){var lines=block.split("\\n").map(function(line){return line.trim()}).filter(Boolean);var isList=lines.length&&lines.every(function(line){return isListLine(line)});if(isList){return"<ul>"+lines.map(function(line){return"<li>"+applyInlineFormatting(stripListMarker(line))+"</li>"}).join("")+"</ul>"}return"<p>"+applyInlineFormatting(block.split("\\n").join("<br>"))+"</p>"}).join("")}
  function normalizeAgentNewlines(text){return String(text||"").split("\\r\\n").join("\\n").split("\\r").join("\\n")}
  function isListLine(line){return line.indexOf("- ")===0||line.indexOf("* ")===0||line.indexOf("\u2022 ")===0}
  function stripListMarker(line){if(line.indexOf("- ")===0||line.indexOf("* ")===0||line.indexOf("\u2022 ")===0)return line.slice(2);return line}
  function applyInlineFormatting(text){var value=String(text||"");var parts=value.split("**");if(parts.length<3)return value;return parts.map(function(part,index){return index%2===1?"<strong>"+part+"</strong>":part}).join("")}
  function openAdvisor(){if(!advisorPanel)return;advisorPanel.hidden=false;advisorPanel.style.display="grid";if(advisorToggle){advisorToggle.setAttribute("aria-expanded","true");advisorToggle.classList.add("active")}if(!advisorMessages?.children.length)seedAdvisor();advisorPanel.scrollIntoView({behavior:"smooth",block:"start"});advisorInput?.focus()}
  function closeAdvisor(){if(!advisorPanel)return;if(advisorRoot?.dataset?.standalone==="true"){advisorPanel.scrollIntoView({behavior:"smooth",block:"start"});return}advisorPanel.hidden=true;advisorPanel.style.display="none";if(advisorToggle){advisorToggle.setAttribute("aria-expanded","false");advisorToggle.classList.remove("active")}}
  window.__jfOpenAdvisor=openAdvisor;
  window.__jfCloseAdvisor=closeAdvisor;
  if(advisorRoot?.dataset?.standalone==="true"){advisorPanel.hidden=false;advisorPanel.style.display="grid"}
  function addAdvisorMessage(role,text,meta){if(!advisorMessages||!text)return;const div=document.createElement("div");div.className="advisor-msg "+role;const body=document.createElement("div");body.className="advisor-msg-text";body.innerHTML=formatAgentText(text);div.appendChild(body);if(role==="assistant"&&meta){renderAdvisorMeta(div,meta)}advisorMessages.appendChild(div);advisorMessages.scrollTop=advisorMessages.scrollHeight}
  function renderAdvisorMeta(container,meta){var evidenceItems=(meta.evidence||[]).filter(Boolean).slice(0,3);if(evidenceItems.length&&meta.confidence!=="low"){var chips=document.createElement("div");chips.className="advisor-evidence-chips";evidenceItems.forEach(function(item){var chip=document.createElement("span");chip.className="advisor-evidence-chip";chip.textContent=item;chips.appendChild(chip)});container.appendChild(chips)}var nextAction=(meta.next_actions||[]).filter(Boolean)[0];if(nextAction){var block=document.createElement("div");block.className="advisor-block advisor-next-action";var strong=document.createElement("strong");strong.textContent="Next step";block.appendChild(strong);var p=document.createElement("p");p.style.cssText="margin:.2rem 0 0;font-size:.88rem;line-height:1.45";p.textContent=nextAction;block.appendChild(p);container.appendChild(block)}renderEvidenceLinks(container,meta.evidence_links||[]);renderFollowUpQuestions(container,meta.follow_up_questions||[]);renderNavActions(container,meta.navigation_actions||[])}
  function renderEvidenceLinks(container,links){var normalized=(links||[]).filter(function(item){return item&&item.label&&item.target});if(!normalized.length)return;var wrap=document.createElement("div");wrap.className="advisor-evidence-links";normalized.slice(0,4).forEach(function(item){var btn=document.createElement("button");btn.type="button";btn.className="advisor-evidence-link";btn.textContent=item.label;btn.addEventListener("click",function(){openEvidenceTarget(item.target,item.prompt||"")});wrap.appendChild(btn)});container.appendChild(wrap)}
  function renderRootCauseTree(container,items){var rows=(items||[]).filter(function(item){return item&&item.label&&item.reason});if(!rows.length)return;var block=document.createElement("div");block.className="advisor-block";var title=document.createElement("strong");title.textContent="Root-Cause Tree";block.appendChild(title);var list=document.createElement("ul");rows.slice(0,5).forEach(function(item){var li=document.createElement("li");li.textContent=item.label+" ("+Math.round((Number(item.score||0))*100)+"%): "+item.reason;list.appendChild(li)});block.appendChild(list);container.appendChild(block)}
  function renderFollowUpQuestions(container,questions){var items=(questions||[]).filter(Boolean);if(!items.length)return;var wrap=document.createElement("div");wrap.className="advisor-follow-up-links";items.slice(0,3).forEach(function(item){var btn=document.createElement("button");btn.type="button";btn.className="advisor-follow-up-btn";btn.textContent=item;btn.addEventListener("click",function(){openAdvisor();advisorInput.value=item;advisorForm?.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))});wrap.appendChild(btn)});container.appendChild(wrap)}
  function renderNavActions(container,navActions){var items=(navActions||[]).filter(function(a){return a&&a.label&&a.href});if(!items.length)return;var wrap=document.createElement("div");wrap.className="advisor-nav-actions";items.slice(0,3).forEach(function(action){var a=document.createElement("a");a.href=action.href;a.className="advisor-nav-btn";a.textContent="\u2192 "+action.label;wrap.appendChild(a)});container.appendChild(wrap)}
  function renderRecommendationMemoryActions(container,nextActions){var items=(nextActions||[]).filter(Boolean);if(!items.length)return;var wrap=document.createElement("div");wrap.className="advisor-memory-actions";items.slice(0,2).forEach(function(item){["done","noted"].forEach(function(status){var btn=document.createElement("button");btn.type="button";btn.className="advisor-memory-btn";btn.textContent=(status==="done"?"Mark done: ":"Note: ")+item;btn.addEventListener("click",function(){saveRecommendationMemory(item,status)});wrap.appendChild(btn)})});container.appendChild(wrap)}
  function setQuickActions(actions){if(!advisorQuick)return;advisorQuick.innerHTML="";(actions||[]).slice(0,4).forEach(function(action){const btn=document.createElement("button");btn.type="button";btn.className="advisor-quick-btn";btn.textContent=action;btn.addEventListener("click",function(){advisorInput.value=action;advisorForm?.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))});advisorQuick.appendChild(btn)})}
  function setAdvisorMode(mode){if(!advisorStatus)return;advisorStatus.textContent=mode==="openai"?"AI explanation mode. The tracked data is still the source of truth.":mode==="grounded-direct"?"Direct answer mode. This reply came straight from the tracked facts on the page.":"Grounded fallback mode. The tracked data is the source of truth, but OpenAI is not active for this reply."}
  function seedAdvisor(){const saved=readAdvisorState();const isAutoAnalyze=Boolean(advisorState.context&&advisorState.context.auto_analyze);const initial=isAutoAnalyze?"Looking at your data now...":((advisorState.context&&advisorState.context.initial_message)||"I am your Just Flow Genie. I use the tracked data on this page as the source of truth and turn it into clear advice.");var initialMode=advisorState.context&&advisorState.context.initial_mode||"grounded-direct";addAdvisorMessage("assistant",initial,{confidence:"medium",next_actions:[advisorState.context.next_action_hint||"Ask what changed, what matters, or what to do next."]});advisorState.messages=[{role:"assistant",content:initial,meta:{confidence:"medium",next_actions:[advisorState.context.next_action_hint||"Ask what changed, what matters, or what to do next."]}}];setAdvisorMode(initialMode);persistAdvisorState(initialMode);setQuickActions(resolveAdvisorQuickActions(advisorState.context,[]));if(isAutoAnalyze&&!saved?.messages?.length){setTimeout(function(){sendAdvisorMessage("__auto_analyze__")},400)}}
  async function sendAdvisorMessage(message){if(isSending)return;isSending=true;setInputLocked(true);advisorState.messages.push({role:"user",content:message});persistAdvisorState();if(message!=="__auto_analyze__"){addAdvisorMessage("user",message)}advisorInput.value="";addThinkingBubble();try{const response=await fetch("/admin/advisor/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page:advisorState.context.page||"app",context:Object.assign({},advisorState.context,buildCurrentFilterContext(),{selected_mode:advisorMode?.value||"operator",entity_memory:readEntityMemory(),recommendation_memory:readRecommendationMemory()}),messages:advisorState.messages})});const body=await response.json();removeThinkingBubble();const reply=body&&body.reply?body.reply:"I could not produce a grounded answer for that yet.";const meta={confidence:body.confidence||"medium",confidence_detail:body.confidence_detail||"",evidence:body.evidence||[],evidence_links:body.evidence_links||[],root_causes:body.root_causes||[],root_cause_tree:body.root_cause_tree||[],next_actions:body.next_actions||[],follow_up_questions:body.follow_up_questions||[],recommendation_memory_note:body.recommendation_memory_note||"",navigation_actions:body.navigation_actions||[],export_text:body.export_text||reply,action_plan_text:body.action_plan_text||body.export_text||reply,client_summary_text:body.client_summary_text||body.export_text||reply};advisorState.messages.push({role:"assistant",content:reply,meta:meta});setAdvisorMode(body.mode||"fallback");persistAdvisorState(body.mode||"fallback");addAdvisorMessage("assistant",reply,meta);setQuickActions(resolveAdvisorQuickActions(advisorState.context,body.quick_actions||[]));rememberEntitiesFromContext(Object.assign({},advisorState.context,buildCurrentFilterContext()))}catch(e){removeThinkingBubble();const failure="I could not answer that right now. Check that the app has enough data for this page and try again.";advisorState.messages.push({role:"assistant",content:failure,meta:{confidence:"low"}});setAdvisorMode("fallback");persistAdvisorState("fallback");addAdvisorMessage("assistant",failure,{confidence:"low"})}finally{isSending=false;setInputLocked(false)}}
  function hydrateAdvisorState(){const saved=readAdvisorState();if(!saved||!Array.isArray(saved.messages)||!saved.messages.length)return;advisorState.messages=saved.messages.slice(-12);if(advisorMode&&saved.selected_mode)advisorMode.value=saved.selected_mode;setAdvisorMode(saved.mode||"fallback");advisorState.messages.forEach(function(message){addAdvisorMessage(message.role==="user"?"user":"assistant",message.content,message.meta)});setQuickActions(resolveAdvisorQuickActions(advisorState.context,saved.quickActions||[]))}
  function persistAdvisorState(mode){try{const payload=JSON.stringify({messages:advisorState.messages.slice(-12),quickActions:resolveAdvisorQuickActions(advisorState.context,[]),mode:mode||"fallback",selected_mode:advisorMode?.value||"operator",filter_context:buildCurrentFilterContext().filter_context||{},savedAt:new Date().toISOString()});advisorStorageKeys.forEach(function(key){window.sessionStorage.setItem(key,payload);window.localStorage.setItem(key,payload)})}catch(e){}}
  function readAdvisorState(){try{for(var i=0;i<advisorStorageKeys.length;i+=1){const sessionRaw=window.sessionStorage.getItem(advisorStorageKeys[i]);if(sessionRaw){return JSON.parse(sessionRaw)}const localRaw=window.localStorage.getItem(advisorStorageKeys[i]);if(localRaw){return JSON.parse(localRaw)}}return null}catch(e){return null}}
  function getAdvisorStorageKeys(context){const keys=[];const exact=getAdvisorStorageKey(context);if(exact)keys.push(exact);const related=getAdvisorRelatedStorageKey(context);if(related&&keys.indexOf(related)===-1)keys.push(related);return keys}
  function getAdvisorStorageKey(context){const page=String(context&&context.page||"app");const entityKey=getAdvisorEntityKey(context);const memoryScope=String(context&&context.memory_scope||page);return "jf-advisor:"+memoryScope+":"+(entityKey||page)}
  function getAdvisorRelatedStorageKey(context){const group=getAdvisorMemoryGroup(context);const entityKey=getAdvisorEntityKey(context);if(!group)return"";return "jf-advisor-group:"+group+":"+(entityKey||"shared")}
  function getAdvisorMemoryGroup(context){const page=String(context&&context.page||"app");if(["dashboard","executive-summary","reports","snapshot","link-performance"].indexOf(page)>=0)return"campaign-insights";if(["profiles","leads"].indexOf(page)>=0)return"person-journey";if(page==="websites")return"site-health";return""}
  function getAdvisorEntityKey(context){const facts=context&&context.facts&&typeof context.facts==="object"?context.facts:{};if(facts.selected_profile&&facts.selected_profile.stitched_profile_id)return"profile-"+facts.selected_profile.stitched_profile_id;if(facts.stitched_profile_id)return"profile-"+facts.stitched_profile_id;if(facts.lead_id)return"lead-"+facts.lead_id;if(facts.lead_uuid)return"lead-"+facts.lead_uuid;if(facts.website_id)return"website-"+facts.website_id;if(facts.scope_label)return"scope-"+String(facts.scope_label).toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,80);return""}
  function rememberEntitiesFromContext(context){try{var facts=context&&context.facts&&typeof context.facts==="object"?context.facts:{};var entities=readEntityMemory();["top_campaign","top_channel","top_form","top_landing_page","top_page_funnel"].forEach(function(key){var item=facts[key];if(item&&typeof item==="object"){var label=item.label||item.campaign||item.page||item.form_title||item.page_path||null;entities[key]=label;if(key==="top_campaign")entities.last_campaign=label;if(key==="top_channel")entities.last_channel=label;if(key==="top_form")entities.last_form=label;if(key==="top_landing_page"||key==="top_page_funnel")entities.last_page=label}});if(facts.first_source)entities.first_source=facts.first_source;if(facts.latest_source)entities.latest_source=facts.latest_source;var filters=buildCurrentFilterContext().filter_context||{};entities.filter_context=filters;window.sessionStorage.setItem("jf-advisor-entities",JSON.stringify(entities));window.localStorage.setItem("jf-advisor-entities",JSON.stringify(entities))}catch(e){}}
  function readEntityMemory(){try{var sessionRaw=window.sessionStorage.getItem("jf-advisor-entities");if(sessionRaw)return JSON.parse(sessionRaw);var localRaw=window.localStorage.getItem("jf-advisor-entities");return localRaw?JSON.parse(localRaw):{}}catch(e){return {}}}
  function saveRecommendationMemory(action,status){try{var memory=readRecommendationMemory();var key=normalizeMemoryKey(action);memory[key]={status:status,updated_at:new Date().toISOString()};window.sessionStorage.setItem("jf-advisor-recommendations",JSON.stringify(memory));window.localStorage.setItem("jf-advisor-recommendations",JSON.stringify(memory));window.showToast&&window.showToast("Saved recommendation memory.")}catch(e){}}
  function readRecommendationMemory(){try{var sessionRaw=window.sessionStorage.getItem("jf-advisor-recommendations");if(sessionRaw)return JSON.parse(sessionRaw);var localRaw=window.localStorage.getItem("jf-advisor-recommendations");return localRaw?JSON.parse(localRaw):{}}catch(e){return {}}}
  function resolveAdvisorQuickActions(context,serverActions){const seeded=Array.isArray(context&&context.quick_actions)?context.quick_actions:[];const dynamic=buildDynamicAdvisorQuickActions(context);const supplied=Array.isArray(serverActions)?serverActions:[];return Array.from(new Set([].concat(seeded,dynamic,supplied,["What changed here?","What should I do next?","Explain this page","Where is the biggest risk?"]).filter(Boolean))).slice(0,4)}
  function buildDynamicAdvisorQuickActions(context){const page=String(context&&context.page||"app");const facts=context&&context.facts&&typeof context.facts==="object"?context.facts:{};switch(page){case"websites":return[(Number(facts.stale_websites||0)>0?"Which stale sites need fixing first?":""),(Number(facts.failing_websites||0)>0?"Which site has the biggest tracking risk?":""),((facts.highest_queue_site&&(Number(facts.highest_queue_site.browser_queue_depth||0)>0||Number(facts.highest_queue_site.wp_queue_depth||0)>0))?"Which site has queue buildup?":"")].filter(Boolean);case"snapshot":return[(facts.weakest_funnel_step&&facts.weakest_funnel_step.label?("Why is "+facts.weakest_funnel_step.label+" weak?"):""),(facts.top_channel&&facts.top_channel.label?"Which source is driving the best funnel?":""),(facts.top_form&&facts.top_form.label?("How is "+facts.top_form.label+" performing?"):"")].filter(Boolean);case"profiles":return[(facts.selected_profile&&facts.selected_profile.first_touch?"What was the first source for this person?":""),(Number(facts.selected_profile&&facts.selected_profile.timeline_items||0)>3?"What happened right before conversion?":""),(facts.selected_profile&&facts.selected_profile.linked_lead_status?"How does this journey connect to the lead?":"")].filter(Boolean);case"link-performance":return[(facts.top_campaign&&facts.top_campaign.campaign?("Should we scale "+facts.top_campaign.campaign+"?"):""),(Number(facts.sessions||0)>Number(facts.attributed_conversions||0)*10?"Why are visits not turning into attributed conversions?":""),(Number(facts.attributed_value||0)>0?"Which link creates the most value?":"")].filter(Boolean);case"dashboard":return[(Number(facts.stale_sites||0)>0?"Which stale sites need fixing first?":""),(Number(facts.tracking_alerts||0)>0?"What tracking issue matters most?":""),(Number(facts.abandonment_rate||0)>0.3?"Why is abandonment high?":"")].filter(Boolean);case"executive-summary":return[(Number(facts.alert_count||0)>0?"Which alert should we act on first?":""),(Number(facts.top_declines_count||0)>0?"What declined most?":""),(Number(facts.qualified_leads||0)>0?"How would you explain this to a client?":"")].filter(Boolean);case"reports":return[(Number(facts.page_abandonment_rate||0)>0.3?"Which pages are losing people?":""),(Number(facts.anomaly_count||0)>0?"What anomaly matters most?":""),(Number(facts.qualified_leads||0)>0?"Where does lead quality look weakest?":"")].filter(Boolean);case"leads":return[(facts.latest_source?"Is this lead source trustworthy?":""),(Number(facts.visits_before_submit||0)>1?"What happened before the form submit?":""),(facts.follow_up_state==="overdue"?"What should happen next with this lead?":"")].filter(Boolean);default:return[]}}
  advisorToggle?.addEventListener("click",function(event){event.preventDefault();if(advisorPanel?.hidden)openAdvisor();else closeAdvisor()});
  advisorClose?.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();closeAdvisor()});
  advisorMode?.addEventListener("change",function(){persistAdvisorState()});
  advisorExport?.addEventListener("click",function(){var last=lastAssistantMessage();var exportText=(last&&last.meta&&last.meta.export_text)||((last&&last.content)||"");if(exportText&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(exportText)}});
  advisorActionPlan?.addEventListener("click",function(){var last=lastAssistantMessage();var text=(last&&last.meta&&last.meta.action_plan_text)||((last&&last.meta&&last.meta.export_text)||((last&&last.content)||""));downloadAdvisorText("justflow-action-plan.txt",text)});
  advisorClientSummary?.addEventListener("click",function(){var last=lastAssistantMessage();var text=(last&&last.meta&&last.meta.client_summary_text)||((last&&last.meta&&last.meta.export_text)||((last&&last.content)||""));downloadAdvisorText("justflow-client-summary.txt",text)});
  advisorMonthlyUpdate?.addEventListener("click",function(){openAdvisor();advisorMode.value="client";advisorInput.value="Write monthly client update";advisorForm?.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))});
  advisorInternalBrief?.addEventListener("click",function(){openAdvisor();advisorMode.value="operator";advisorInput.value="Write internal operator brief";advisorForm?.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))});
  advisorExecSummary?.addEventListener("click",function(){openAdvisor();advisorMode.value="executive";advisorInput.value="Write executive action summary";advisorForm?.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))});
  document.addEventListener("click",function(event){const closeTrigger=event.target&&event.target.closest?event.target.closest("[data-close-advisor]"):null;if(closeTrigger){event.preventDefault();event.stopPropagation();closeAdvisor();return}});
  document.querySelectorAll(".panel h2,.panel h3,.card h3,.table-card h3").forEach(function(heading){registerEvidenceSection(heading)});
  advisorPanel?.addEventListener("keydown",function(event){if(event.key==="Escape"){event.preventDefault();closeAdvisor()}});
  advisorForm?.addEventListener("submit",function(e){e.preventDefault();const value=String(advisorInput?.value||"").trim();if(!value||isSending)return;if(advisorPanel?.hidden)openAdvisor();sendAdvisorMessage(value)});
  function lastAssistantMessage(){return [...advisorState.messages].reverse().find(function(item){return item.role==="assistant"})||null}
  function downloadAdvisorText(filename,text){if(!text)return;var blob=new Blob([text],{type:"text/plain;charset=utf-8"});var url=URL.createObjectURL(blob);var link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);setTimeout(function(){URL.revokeObjectURL(url)},0)}
  function buildCurrentFilterContext(){try{var params=new URLSearchParams(window.location.search||"");var context={};params.forEach(function(value,key){if(value!==""&&value!=null)context[key]=value});return {filter_context:context}}catch(e){return {filter_context:{}}}}
  function registerEvidenceSection(heading){var section=heading.closest(".panel,.table-card,.card,.hero");if(!section)return;var headingKey=normalizeAskHeading(heading.textContent||"");var targetKey=resolveEvidenceTargetKey(advisorState.context,headingKey);if(!targetKey)return;var sectionId="jf-evidence-"+targetKey;if(!section.id)section.id=sectionId;section.setAttribute("data-advisor-target",targetKey)}
  function resolveEvidenceTargetKey(context,heading){var page=String(context&&context.page||"app");var map={dashboard:{"dashboard":"overview","filters":"filters","channel mix":"channel-mix","top landing pages":"top-landing-pages","campaign results":"campaign-results","page level funnel":"page-funnel","funnel snapshot":"funnel-snapshot","tracking health":"tracking-health","stale tracking alerts":"stale-tracking-alerts","alerts":"alerts"},snapshot:{"marketing snapshot":"overview","filters":"filters","traffic sources by channel":"channel-mix","form submissions":"form-submissions","top campaigns":"campaign-results","how is the funnel performing":"funnel-snapshot"},reports:{"performance reports":"overview","filters":"filters","traffic":"channel-mix","page level funnel":"page-funnel","behavior signals":"behavior-signals","attribution":"attribution","top campaigns":"campaign-results","top channels":"channel-mix","lead journey depth":"journey-depth","form field abandonment":"form-friction","form field errors":"form-friction"}, "executive-summary":{"executive summary":"overview","top channels":"channel-mix","top campaigns":"campaign-results","top landing pages":"top-landing-pages","page funnel":"page-funnel","what declined":"what-declined","alerts":"alerts"}, "link-performance":{"link results":"overview","filters":"filters","top campaigns":"campaign-results","saved links with results":"attribution"}, websites:{"sites":"overview","tracking health":"tracking-health","stale tracking alerts":"stale-tracking-alerts","alerts":"alerts"}};if(map[page]&&map[page][heading])return map[page][heading];if(heading.indexOf("filter")>=0)return"filters";if(heading.indexOf("campaign")>=0)return"campaign-results";if(heading.indexOf("channel")>=0||heading.indexOf("source")>=0)return"channel-mix";if(heading.indexOf("journey")>=0)return"journey-depth";if(heading.indexOf("form")>=0&&page==="reports")return"form-friction";if(heading.indexOf("page")>=0)return"page-funnel";if(heading.indexOf("alert")>=0)return"alerts";return""}
  function openEvidenceTarget(target,prompt){var section=document.querySelector('[data-advisor-target=\"'+target+'\"]')||document.getElementById('jf-evidence-'+target)||document.getElementById(target);if(section&&typeof section.scrollIntoView==='function'){section.scrollIntoView({behavior:'smooth',block:'start'});try{section.classList.add("advisor-evidence-hit");setTimeout(function(){section.classList.remove("advisor-evidence-hit")},1800)}catch(e){}}else if(target==="overview"){window.scrollTo({top:0,behavior:'smooth'})}var parts=String(target||"").split(":");if(parts.length===2){rememberEntityTarget(parts[0],parts[1])}if(prompt){openAdvisor();advisorInput.value=prompt}}
  window.openAdvisorEvidenceTarget=openEvidenceTarget;
  function rememberEntityTarget(section,slug){try{var entities=readEntityMemory();if(section==="page-funnel")entities.last_page=slug;if(section==="campaign-results")entities.last_campaign=slug;if(section==="channel-mix")entities.last_channel=slug;if(section==="form-submissions")entities.last_form=slug;window.sessionStorage.setItem("jf-advisor-entities",JSON.stringify(entities));window.localStorage.setItem("jf-advisor-entities",JSON.stringify(entities))}catch(e){}}
  function normalizeMemoryKey(value){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,120)}
  function resolveFilterScopeText(){var filters=buildCurrentFilterContext().filter_context||{};return Object.keys(filters).length?Object.keys(filters).map(function(key){return key+'='+filters[key]}).join(', '):''}
  function navigateToGenie(prompt){try{var params=new URLSearchParams(window.location.search||"");if(prompt)params.set("prompt",prompt);params.set("from_page",advisorState.context.page||"app");params.set("selected_mode",advisorMode?.value||"operator");var filters=buildCurrentFilterContext().filter_context||{};["client_id","website_id","date_from","date_to","model"].forEach(function(key){if(filters[key])params.set(key,filters[key])});var entity=resolveGenieEntityContext(prompt,advisorState.context,readEntityMemory());if(entity.type)params.set("entity_type",entity.type);if(entity.id)params.set("entity_id",entity.id);if(entity.label)params.set("entity_label",entity.label);window.location.href="/admin/genie"+(params.toString()?"?"+params.toString():"")}catch(e){window.location.href="/admin/genie"}}
  function resolveGenieEntityContext(prompt,context,entityMemory){var text=String(prompt||"").toLowerCase();var facts=context&&context.facts&&typeof context.facts==="object"?context.facts:{};if(/campaign|budget|scale|pause/.test(text)){return {type:"campaign",id:"",label:(entityMemory&&entityMemory.last_campaign)||(facts.top_campaign&&facts.top_campaign.label)||""}}if(/page|landing/.test(text)){return {type:"page",id:"",label:(entityMemory&&entityMemory.last_page)||(facts.top_landing_page&&facts.top_landing_page.label)||(facts.top_page_funnel&&facts.top_page_funnel.label)||""}}if(/form/.test(text)){return {type:"form",id:"",label:(entityMemory&&entityMemory.last_form)||(facts.top_form&&facts.top_form.label)||""}}if(/channel|source|facebook|google|organic|paid/.test(text)){return {type:"channel",id:"",label:(entityMemory&&entityMemory.last_channel)||(facts.top_channel&&facts.top_channel.label)||""}}if(facts.lead_id||facts.lead_uuid){return {type:"lead",id:String(facts.lead_id||facts.lead_uuid||""),label:String(facts.lead_uuid||facts.lead_id||"")}}if(facts.website_id){return {type:"site",id:String(facts.website_id),label:(facts.website_name||"")}}return {type:"",id:"",label:""}}
  function normalizeAskHeading(text){return String(text||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ")}
  function resolveAskButtonLabel(context,headingText){var prompt=resolveAskPrompt(context,headingText);if(/^why /i.test(prompt))return"Why?";if(/^which /i.test(prompt))return"Ask Weakest";if(/^what should/i.test(prompt))return"Ask Action";if(/^what is /i.test(prompt)||/^what'?s /i.test(prompt))return"Ask Insight";return"Ask Genie"}
  function resolveAskPrompt(context,headingText){var page=String(context&&context.page||"app");var heading=normalizeAskHeading(headingText);var mappings={dashboard:{"funnel snapshot":"What should I do next?","channel mix":"What is the strongest source?","top landing pages":"Which page is weakest?","campaign results":"Which campaign should we pause?","behavior signals":"What changed here?","page level funnel":"Which page is weakest?","trend lines":"What changed here?","tracking health":"What is the biggest tracking risk?","stale tracking alerts":"Why is there no data?","alerts":"What is the biggest risk?"},snapshot:{"traffic sources by channel":"Which source looks strongest?","form submissions":"Which form is weak?","how is the funnel performing":"What changed here?","top campaigns":"Which campaign should we pause?","top lead sources":"What changed here?"},"executive-summary":{"what improved":"What improved?","what declined":"What declined?","alerts":"What should we do next?","top channels":"What is the strongest source?","top campaigns":"Which campaign should we pause?","top landing pages":"Which page is weakest?","page funnel":"Which page is weakest?","lead quality shift":"What changed here?"},reports:{"traffic":"What changed here?","page level funnel":"Which page is weakest?","behavior signals":"What changed here?","top campaigns":"Which campaign should we pause?","top channels":"What is the strongest source?","attribution":"Why is attribution missing?"},"link-performance":{"links with qr codes":"What changed here?","links with short links":"What changed here?","top campaigns":"Which campaign should we pause?","saved links with results":"Why is attribution missing?"},websites:{"tracking health":"What is the biggest tracking risk?","stale tracking alerts":"Why is there no data?","alerts":"What should we fix first?"}};var map=mappings[page]||{};if(map[heading])return map[heading];if(heading.indexOf("campaign")>=0)return"Which campaign should we pause?";if(heading.indexOf("page")>=0&&heading.indexOf("funnel")>=0)return"Which page is weakest?";if(heading.indexOf("form")>=0)return"Which form is weak?";if(heading.indexOf("channel")>=0||heading.indexOf("source")>=0)return"What is the strongest source?";if(heading.indexOf("alert")>=0||heading.indexOf("tracking")>=0)return"What is the biggest tracking risk?";return"Explain "+String(headingText||"").trim()}
})();
</script>`;
}

export function renderToastScript() {
  return `<script>
(function(){const t=document.getElementById("app-toast");let timer=null;window.showToast=function(msg,type){if(!t||!msg)return;t.textContent=msg;t.className="toast visible"+(type==="warning"?" warning":type==="error"?" error":"");clearTimeout(timer);timer=setTimeout(function(){t.classList.remove("visible")},2800)};
})();
</script>`;
}

function escapeGuide(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}
