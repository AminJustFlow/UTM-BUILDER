export function renderAuthPage({ title = "Just Flow", heading = "", lede = "", error = "", notice = "", body = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--bg:#f4efe5;--panel:rgba(255,250,242,.96);--ink:#17302a;--muted:#66766f;--accent:#018CC6;--line:rgba(23,48,42,.1);--danger:#b4432b;--ok:#18734c;--shadow:0 24px 60px rgba(20,32,31,.09)}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;color:var(--ink);font-family:"Aptos","Segoe UI",sans-serif;background:radial-gradient(circle at top left,rgba(1,140,198,.18),transparent 32rem),radial-gradient(circle at top right,rgba(183,142,65,.12),transparent 26rem),linear-gradient(180deg,#faf7f1 0%,var(--bg) 100%)}
    .card{width:min(100%,30rem);padding:1.5rem;background:var(--panel);border:1px solid var(--line);border-radius:1.35rem;box-shadow:var(--shadow)}
    h1,h2,p{margin:0}h1{font-family:"Aptos Display","Trebuchet MS",sans-serif;font-size:clamp(1.8rem,5vw,2.6rem);letter-spacing:-.05em}.lede{margin-top:.45rem;color:var(--muted);line-height:1.5}
    form{display:grid;gap:.85rem;margin-top:1.2rem}label{display:grid;gap:.35rem;color:var(--muted);font-size:.92rem}
    input,select{width:100%;padding:.82rem .9rem;border:1px solid rgba(23,48,42,.14);border-radius:.95rem;background:rgba(255,255,255,.9);font:inherit;color:var(--ink)}
    input:focus,select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(1,140,198,.14);background:#fff}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:2.9rem;padding:.82rem 1rem;border-radius:999px;border:0;background:var(--accent);color:#fff;font:inherit;cursor:pointer}
    .button.secondary{background:#fff;color:var(--ink);border:1px solid rgba(23,48,42,.16)}
    .button.danger{background:var(--danger)}
    .error{margin-top:1rem;padding:.75rem .85rem;border-radius:.95rem;background:rgba(180,67,43,.1);color:var(--danger)}
    .notice{margin-top:1rem;padding:.75rem .85rem;border-radius:.95rem;background:rgba(24,115,76,.1);color:var(--ok)}
    .auth-foot{margin-top:1rem;color:var(--muted);font-size:.88rem}.auth-foot a{color:var(--accent)}
    table{width:100%;border-collapse:collapse;margin-top:1rem;font-size:.9rem}th,td{text-align:left;padding:.55rem .4rem;border-bottom:1px solid var(--line);vertical-align:middle}th{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
    .row-actions{display:flex;gap:.4rem;flex-wrap:wrap}.row-actions form{margin:0;display:inline}.row-actions .button{min-height:2.1rem;padding:.35rem .7rem;font-size:.82rem;border-radius:.7rem}
    .pill{display:inline-flex;align-items:center;padding:.2rem .55rem;border-radius:999px;font-size:.74rem;font-weight:600}.pill.on{background:rgba(24,115,76,.12);color:var(--ok)}.pill.off{background:rgba(180,67,43,.12);color:var(--danger)}
    .section-title{margin-top:1.6rem;font-size:1rem;font-weight:700}
    fieldset{border:1px solid var(--line);border-radius:1rem;padding:1rem;margin:1rem 0 0}legend{padding:0 .4rem;color:var(--muted);font-size:.82rem}
  </style>
</head>
<body>
  <main class="card">
    ${heading ? `<h1>${escapeHtml(heading)}</h1>` : ""}
    ${lede ? `<p class="lede">${escapeHtml(lede)}</p>` : ""}
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
    ${body}
  </main>
</body>
</html>`;
}

export function parseFormBody(rawBody) {
  const params = new URLSearchParams(String(rawBody ?? ""));
  return Object.fromEntries(params.entries());
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeReturnTo(value) {
  const text = normalizeText(value);
  if (!text.startsWith("/") || text.startsWith("//")) {
    return "";
  }
  return text;
}

export function isSecureRequest(request) {
  const forwardedProto = normalizeText(request?.header?.("x-forwarded-proto"));
  if (forwardedProto.toLowerCase() === "https") {
    return true;
  }

  const origin = normalizeText(request?.header?.("origin"));
  if (origin.toLowerCase().startsWith("https://")) {
    return true;
  }

  const referer = normalizeText(request?.header?.("referer"));
  if (referer.toLowerCase().startsWith("https://")) {
    return true;
  }

  return false;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}
