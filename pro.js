/* ResumeRadar Pro — one-time-purchase tier. Hidden entirely until
   PRO_CONFIG.paymentLink is set, so the free tool stays clean. */
"use strict";

const PRO_KEY = "rr_pro_unlocked";

function proConfigured() {
  return typeof PRO_CONFIG !== "undefined" && !!PRO_CONFIG.paymentLink;
}
function isPro() {
  return localStorage.getItem(PRO_KEY) === "yes";
}
function setPro() {
  localStorage.setItem(PRO_KEY, "yes");
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyUnlockCode(code) {
  code = code.trim();
  if (!code) return false;

  // Option A: Lemon Squeezy license key (their license API is CORS-open for client use)
  const ls = PRO_CONFIG.lemonSqueezy || {};
  if (ls.storeId || ls.productId) {
    try {
      const body = new FormData();
      body.append("license_key", code);
      const res = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
      const data = await res.json();
      if (data.valid === true) {
        const meta = data.meta || {};
        const storeOk = !ls.storeId || String(meta.store_id) === String(ls.storeId);
        const prodOk = !ls.productId || String(meta.product_id) === String(ls.productId);
        if (storeOk && prodOk) return true;
      }
    } catch (_) { /* network error — fall through to option B */ }
  }

  // Option B: offline unlock code matched by SHA-256 hash
  if (PRO_CONFIG.unlockCodeHash) {
    try {
      const hex = await sha256hex(code);
      if (hex === PRO_CONFIG.unlockCodeHash.toLowerCase()) return true;
    } catch (_) { /* crypto.subtle requires https/localhost */ }
  }
  return false;
}

// ───────────────────────── report ─────────────────────────

function reportSection(title, hint, missing, matched) {
  const list = (items, cls) => items.length
    ? `<ul class="r-list ${cls}">` + items.map((i) => `<li>${escapeHtml(typeof i === "string" ? i : i.name)}</li>`).join("") + "</ul>"
    : `<p class="r-none">None</p>`;
  return `
    <section>
      <h2>${title}</h2>
      <p class="r-hint">${hint}</p>
      <h3 class="r-miss">Missing — add these where genuinely true</h3>
      ${list(missing, "miss")}
      <h3 class="r-hit">Already covered</h3>
      ${list(matched, "hit")}
    </section>`;
}

function buildReportHtml(r) {
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const failed = r.checks.filter((c) => !c.ok);
  const passed = r.checks.filter((c) => c.ok);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ResumeRadar Report — ${date}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a2333; max-width: 720px; margin: 40px auto; padding: 0 24px; line-height: 1.55; }
  header { border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: baseline; }
  .brand { font-weight: bold; font-size: 1.1rem; } .brand span { color: #2563eb; }
  .date { color: #5a6679; font-size: .9rem; }
  .score-line { font-size: 1.6rem; margin: 8px 0 2px; }
  .score-line b { color: ${r.score >= 60 ? "#16a34a" : r.score >= 40 ? "#d97706" : "#dc2626"}; }
  h2 { font-size: 1.15rem; border-bottom: 1px solid #e3e8f0; padding-bottom: 4px; margin: 28px 0 6px; }
  h3 { font-size: .85rem; text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 4px; }
  .r-miss { color: #dc2626; } .r-hit { color: #16a34a; }
  .r-hint, .r-none { color: #5a6679; font-size: .92rem; margin: 4px 0; }
  .r-list { margin: 4px 0; padding-left: 22px; columns: 2; }
  .r-list li { margin: 2px 0; font-size: .95rem; }
  .check-fail { margin: 10px 0; } .check-fail b { display: block; }
  .check-fail p { margin: 2px 0 0; color: #5a6679; font-size: .92rem; }
  .pass-line { color: #16a34a; font-size: .92rem; }
  footer { margin-top: 36px; border-top: 1px solid #e3e8f0; padding-top: 12px; color: #5a6679; font-size: .85rem; }
  @media print { body { margin: 12px auto; } }
</style></head><body>
<header><div class="brand">🎯 Resume<span>Radar</span> — Match Report</div><div class="date">${date}</div></header>
<div class="score-line">Overall match: <b>${r.score}%</b></div>
<p class="r-hint">${escapeHtml(scoreMessage(r.score)[1])}</p>
${reportSection("Hard skills & tools", "Recruiters and ATS filters search for these exact terms — the highest-impact fixes.", r.hardMissing, r.hardMatched)}
${reportSection("Keywords from this posting", "Terms this job description repeats. Mirror the posting's language.", r.freeMissing, r.freeMatched)}
${reportSection("Soft skills", "Prove these with examples — “Led 4-person team through launch” beats “leadership”.", r.softMissing, r.softMatched)}
<section><h2>Resume health — action items</h2>
${failed.length ? failed.map((c) => `<div class="check-fail"><b>✗ ${escapeHtml(c.label)}</b><p>${escapeHtml(c.detail)}</p></div>`).join("") : "<p class='r-hint'>All checks passed.</p>"}
<p class="pass-line">✓ Passed: ${passed.map((c) => escapeHtml(c.label)).join(" · ")}</p>
</section>
<footer>Generated locally in your browser by ResumeRadar — your resume was never uploaded. Use your browser's print dialog to save this as a PDF.</footer>
<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body></html>`;
}

function downloadReport() {
  if (!lastResult) return;
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to download the report."); return; }
  w.document.write(buildReportHtml(lastResult));
  w.document.close();
}

// ───────────────────────── wiring ─────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const reportBtn = document.getElementById("report-btn");
  const modal = document.getElementById("pro-modal");
  if (!reportBtn || !modal) return;

  // Free mode: no payment link configured → Pro UI stays hidden, report stays free?
  // No — report is the Pro feature. Until payments are configured we show it free
  // (better launch experience), and it auto-gates once paymentLink is set.
  const gated = proConfigured();
  document.getElementById("pro-badge").hidden = !gated;
  if (PRO_CONFIG.tipLink) {
    const tip = document.getElementById("tip-link");
    tip.href = PRO_CONFIG.tipLink;
    tip.hidden = false;
  }

  reportBtn.addEventListener("click", () => {
    if (!gated || isPro()) { downloadReport(); return; }
    document.getElementById("pro-price").textContent = PRO_CONFIG.price;
    document.getElementById("pro-buy").href = PRO_CONFIG.paymentLink;
    modal.hidden = false;
  });

  document.getElementById("pro-close").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

  document.getElementById("pro-unlock-btn").addEventListener("click", async () => {
    const input = document.getElementById("pro-code");
    const msg = document.getElementById("pro-msg");
    const btn = document.getElementById("pro-unlock-btn");
    btn.disabled = true; msg.textContent = "Checking…"; msg.className = "pro-msg";
    const ok = await verifyUnlockCode(input.value);
    btn.disabled = false;
    if (ok) {
      setPro();
      msg.textContent = "✓ Unlocked — thank you! Generating your report…";
      msg.className = "pro-msg good";
      setTimeout(() => { modal.hidden = true; downloadReport(); }, 900);
    } else {
      msg.textContent = "That code didn't validate. Check your purchase receipt, or email the address on your receipt for help.";
      msg.className = "pro-msg bad";
    }
  });
});
