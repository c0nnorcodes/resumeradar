/* ResumeRadar paywall + accounts-lite.
   Model: scanning is free, but results are blurred behind a one-time $5 unlock.
   The buyer's license key IS their account — enter it on any device to unlock.
   The whole gate stays dormant until PRO_CONFIG.paymentLink is set, so the site
   works as a fully free tool until payments are configured. */
"use strict";

const PRO_KEY = "rr_pro_unlocked";
const LICENSE_STORE = "rr_license_key";

function proConfigured() {
  return typeof PRO_CONFIG !== "undefined" && !!PRO_CONFIG.paymentLink;
}
function isPro() {
  return localStorage.getItem(PRO_KEY) === "yes";
}
function setPro(code) {
  localStorage.setItem(PRO_KEY, "yes");
  localStorage.setItem(LICENSE_STORE, code);
}
function signOut() {
  localStorage.removeItem(PRO_KEY);
  localStorage.removeItem(LICENSE_STORE);
  location.reload();
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

// ───────────────────── results gate ─────────────────────

function buildLockCard() {
  const card = document.createElement("div");
  card.id = "lock-card";
  card.innerHTML = `
    <div class="lock-icon">🔓</div>
    <h3>Your results are ready</h3>
    <p>Unlock ResumeRadar once for <strong>${PRO_CONFIG.price}</strong> — see this full analysis and run
    unlimited scans forever. No subscription. Your license key is your account: enter it on any device.</p>
    <a id="lock-buy" class="btn-primary lock-buy" href="${PRO_CONFIG.paymentLink}" target="_blank" rel="noopener">Unlock for ${PRO_CONFIG.price} →</a>
    <div class="modal-divider">already purchased?</div>
    <div class="unlock-row">
      <input id="pro-code" type="text" placeholder="Paste your license / unlock code">
      <button id="pro-unlock-btn" class="btn-secondary">Unlock</button>
    </div>
    <p id="pro-msg" class="pro-msg"></p>
    <p class="lock-fine">Scanning stays private either way — your resume never leaves your browser, paid or not.</p>`;

  card.querySelector("#pro-unlock-btn").addEventListener("click", async () => {
    const input = card.querySelector("#pro-code");
    const msg = card.querySelector("#pro-msg");
    const btn = card.querySelector("#pro-unlock-btn");
    btn.disabled = true; msg.textContent = "Checking…"; msg.className = "pro-msg";
    const ok = await verifyUnlockCode(input.value);
    btn.disabled = false;
    if (ok) {
      setPro(input.value.trim());
      msg.textContent = "✓ Unlocked — welcome aboard!";
      msg.className = "pro-msg good";
      setTimeout(applyResultsGate, 600);
    } else {
      msg.textContent = "That code didn't validate. Check your purchase receipt for the exact key.";
      msg.className = "pro-msg bad";
    }
  });
  return card;
}

function updateAccountChip() {
  const chip = document.getElementById("account-chip");
  if (!chip) return;
  if (isPro()) {
    chip.hidden = false;
    chip.innerHTML = `★ Pro &nbsp;<span class="signout">sign out</span>`;
    chip.querySelector(".signout").onclick = () => {
      if (confirm("Sign out? You'll need your license key to unlock again.")) signOut();
    };
  } else {
    chip.hidden = true;
  }
}

// Called by app.js after every render, and after unlock.
function applyResultsGate() {
  const results = document.getElementById("results");
  if (!results) return;
  const gated = proConfigured() && !isPro();
  results.classList.toggle("gated", gated);
  let card = document.getElementById("lock-card");
  if (gated) {
    if (!card) {
      card = buildLockCard();
      results.insertBefore(card, results.firstChild);
    }
  } else if (card) {
    card.remove();
  }
  updateAccountChip();
}
window.applyResultsGate = applyResultsGate;

// ───────────────────── page wiring ─────────────────────

document.addEventListener("DOMContentLoaded", () => {
  updateAccountChip();

  // When the paywall is active, keep the hero copy honest.
  if (proConfigured()) {
    const sub = document.querySelector(".subtitle strong");
    if (sub && !isPro()) sub.textContent = `Free scan — ${PRO_CONFIG.price} once for full results, forever. No subscription.`;
  }

  if (PRO_CONFIG.tipLink) {
    const tip = document.getElementById("tip-link");
    if (tip) { tip.href = PRO_CONFIG.tipLink; tip.hidden = false; }
  }

  // PDF report is included in the unlock (or free while payments are unconfigured).
  const reportBtn = document.getElementById("report-btn");
  if (reportBtn) {
    reportBtn.addEventListener("click", () => {
      if (proConfigured() && !isPro()) {
        applyResultsGate();
        document.getElementById("lock-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      downloadReport();
    });
  }
});

// ───────────────────── PDF report ─────────────────────

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
