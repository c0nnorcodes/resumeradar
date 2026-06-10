/* ResumeRadar accounts + paywall, backed by Supabase.
   - Scanning is free for everyone.
   - Seeing results requires an account (free to create).
   - If PRO_CONFIG.paymentLink is set, results additionally require paid=true
     on the user's profile — set by the payment webhook after their one-time
     purchase. Paid status lives on the account, so it follows the user to
     any device they sign in on. */
"use strict";

const supa = (typeof SUPA_CONFIG !== "undefined" && SUPA_CONFIG.url && window.supabase)
  ? window.supabase.createClient(SUPA_CONFIG.url, SUPA_CONFIG.key)
  : null;

let currentSession = null;
let currentProfile = null;

function paymentRequired() {
  return typeof PRO_CONFIG !== "undefined" && !!PRO_CONFIG.paymentLink;
}

function resultsLocked() {
  if (!supa) return false;                    // no backend configured: free site
  if (!currentSession) return true;           // must be signed in
  if (paymentRequired() && !(currentProfile && currentProfile.paid)) return true;
  return false;
}
window.resultsLocked = resultsLocked;

async function fetchProfile() {
  currentProfile = null;
  if (!supa || !currentSession) return;
  try {
    const { data } = await supa
      .from("profiles")
      .select("email,paid")
      .eq("id", currentSession.user.id)
      .maybeSingle();
    currentProfile = data;
  } catch (_) { /* network hiccup — treated as unpaid until refresh */ }
}

function buyLink() {
  let link = PRO_CONFIG.paymentLink;
  const email = currentSession?.user?.email;
  if (link && email && link.includes("lemonsqueezy")) {
    link += (link.includes("?") ? "&" : "?") + "checkout[email]=" + encodeURIComponent(email);
  }
  return link;
}

// ───────────────────── lock card UI ─────────────────────

function lockCardHtml() {
  if (!currentSession) {
    const payNote = paymentRequired()
      ? `<p class="lock-fine">After creating your account, unlock results with a one-time ${PRO_CONFIG.price} purchase — no subscription, yours forever on any device.</p>`
      : `<p class="lock-fine">Accounts are free. Your resume itself still never leaves your browser — your account only stores your email and unlock status.</p>`;
    return `
      <div class="lock-icon">🔒</div>
      <h3>Your results are ready</h3>
      <p>${paymentRequired()
        ? "Sign in to view your analysis."
        : "Create a free account (or sign in) to view your full analysis."}</p>
      <div class="auth-form">
        <input id="auth-email" type="email" placeholder="you@email.com" autocomplete="email">
        <input id="auth-pass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password">
        <button id="auth-submit" class="btn-primary auth-btn" data-mode="signup">Create free account</button>
        <p class="auth-toggle">Already have an account? <a href="#" id="auth-switch">Sign in</a></p>
      </div>
      <p id="auth-msg" class="pro-msg"></p>
      ${payNote}`;
  }
  // signed in but unpaid (only reachable when paymentRequired)
  return `
    <div class="lock-icon">🔓</div>
    <h3>One step left, ${escapeHtml(currentSession.user.email)}</h3>
    <p>Unlock your results with a one-time <strong>${PRO_CONFIG.price}</strong> purchase.
    No subscription — your account stays unlocked forever, on every device. Use the same
    email at checkout (<strong>${escapeHtml(currentSession.user.email)}</strong>) so your
    account is upgraded automatically.</p>
    <a class="btn-primary lock-buy" href="${buyLink()}" target="_blank" rel="noopener">Unlock for ${PRO_CONFIG.price} →</a>
    <div class="modal-divider">just paid?</div>
    <button id="paid-refresh" class="btn-secondary">I've paid — refresh my account</button>
    <p id="auth-msg" class="pro-msg"></p>
    <p class="lock-fine">Wrong account? <a href="#" id="lock-signout">Sign out</a></p>`;
}

function wireLockCard(card) {
  const msg = () => card.querySelector("#auth-msg");

  const switchLink = card.querySelector("#auth-switch");
  if (switchLink) {
    switchLink.addEventListener("click", (e) => {
      e.preventDefault();
      const btn = card.querySelector("#auth-submit");
      const toggle = card.querySelector(".auth-toggle");
      if (btn.dataset.mode === "signup") {
        btn.dataset.mode = "signin";
        btn.textContent = "Sign in";
        toggle.innerHTML = 'New here? <a href="#" id="auth-switch2">Create a free account</a>';
        toggle.querySelector("#auth-switch2").addEventListener("click", (ev) => {
          ev.preventDefault(); applyResultsGate();
        });
      }
    });
  }

  const submit = card.querySelector("#auth-submit");
  if (submit) {
    submit.addEventListener("click", async () => {
      const email = card.querySelector("#auth-email").value.trim();
      const pass = card.querySelector("#auth-pass").value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg().textContent = "Please enter a valid email."; msg().className = "pro-msg bad"; return; }
      if (pass.length < 6) { msg().textContent = "Password needs at least 6 characters."; msg().className = "pro-msg bad"; return; }
      submit.disabled = true;
      msg().textContent = "One moment…"; msg().className = "pro-msg";
      try {
        let res;
        if (submit.dataset.mode === "signup") {
          res = await supa.auth.signUp({ email, password: pass });
          // if the email already exists, fall through to sign-in for smoother UX
          if (!res.error && res.data?.user && res.data.user.identities?.length === 0) {
            res = await supa.auth.signInWithPassword({ email, password: pass });
          }
        } else {
          res = await supa.auth.signInWithPassword({ email, password: pass });
        }
        if (res.error) {
          msg().textContent = res.error.message;
          msg().className = "pro-msg bad";
        }
        // success is handled by onAuthStateChange
      } catch (err) {
        msg().textContent = "Network error — please try again.";
        msg().className = "pro-msg bad";
      }
      submit.disabled = false;
    });
  }

  const refresh = card.querySelector("#paid-refresh");
  if (refresh) {
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      msg().textContent = "Checking your account…"; msg().className = "pro-msg";
      await fetchProfile();
      refresh.disabled = false;
      if (currentProfile?.paid) {
        msg().textContent = "✓ Unlocked — thank you!"; msg().className = "pro-msg good";
        setTimeout(applyResultsGate, 700);
      } else {
        msg().textContent = "Not unlocked yet. Payments can take a minute to process — try again shortly, and make sure you used this email at checkout.";
        msg().className = "pro-msg bad";
      }
    });
  }

  const out = card.querySelector("#lock-signout");
  if (out) out.addEventListener("click", async (e) => { e.preventDefault(); await supa.auth.signOut(); });
}

function updateAccountChip() {
  const chip = document.getElementById("account-chip");
  if (!chip) return;
  if (currentSession) {
    const paidMark = (!paymentRequired() || currentProfile?.paid) ? "★ " : "";
    chip.hidden = false;
    chip.innerHTML = `${paidMark}${escapeHtml(currentSession.user.email)} &nbsp;<span class="signout">sign out</span>`;
    chip.querySelector(".signout").onclick = async () => { await supa.auth.signOut(); };
  } else {
    chip.hidden = true;
  }
}

function applyResultsGate() {
  const results = document.getElementById("results");
  updateAccountChip();
  if (!results) return;
  const locked = resultsLocked();
  results.classList.toggle("gated", locked);
  let card = document.getElementById("lock-card");
  if (locked) {
    // Supabase re-emits SIGNED_IN on token refresh / tab focus — only rebuild
    // the card when its variant actually changes, or we'd wipe the form while
    // the user is typing their password.
    const variant = currentSession ? "unpaid" : "signedout";
    if (card && card.dataset.variant === variant) return;
    if (card) card.remove();
    card = document.createElement("div");
    card.id = "lock-card";
    card.dataset.variant = variant;
    card.innerHTML = lockCardHtml();
    wireLockCard(card);
    results.insertBefore(card, results.firstChild);
  } else if (card) {
    card.remove();
  }
}
window.applyResultsGate = applyResultsGate;

// ───────────────────── init ─────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (PRO_CONFIG.tipLink) {
    const tip = document.getElementById("tip-link");
    if (tip) { tip.href = PRO_CONFIG.tipLink; tip.hidden = false; }
  }

  const reportBtn = document.getElementById("report-btn");
  if (reportBtn) {
    reportBtn.addEventListener("click", () => {
      if (resultsLocked()) {
        applyResultsGate();
        document.getElementById("lock-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      downloadReport();
    });
  }

  if (!supa) return;

  if (paymentRequired()) {
    const sub = document.querySelector(".subtitle strong");
    if (sub) sub.textContent = `Free scan — ${PRO_CONFIG.price} once for full results, forever. No subscription.`;
  }

  const { data: { session } } = await supa.auth.getSession();
  currentSession = session;
  await fetchProfile();
  applyResultsGate();

  supa.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session;
    await fetchProfile();
    applyResultsGate();
  });
});
