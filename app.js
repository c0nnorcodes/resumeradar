/* ResumeRadar — all analysis happens in this file, entirely in the browser. */
"use strict";

// ───────────────────────── helpers ─────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Normalize for matching: lowercase, collapse whitespace, unify dashes/quotes.
function normalize(text) {
  return (" " + text.toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ") + " ");
}

// Word-boundary-ish test that tolerates terms with symbols (c++, .net, node.js).
function containsTerm(normText, term) {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  const re = new RegExp("(^|[^a-z0-9+#.])" + escapeRegex(t) + "($|[^a-z0-9+#])", "i");
  return re.test(normText);
}

// Does the text contain the skill (name or any synonym)?
function skillIn(normText, skill) {
  if (containsTerm(normText, skill.name)) return true;
  return skill.syn.some((s) => containsTerm(normText, s));
}

// Simple plural/suffix-tolerant check for free-text keywords.
function wordIn(normText, word) {
  const stems = [word];
  if (word.endsWith("ies")) stems.push(word.slice(0, -3) + "y");
  else if (word.endsWith("es")) stems.push(word.slice(0, -2));
  else if (word.endsWith("s")) stems.push(word.slice(0, -1));
  else { stems.push(word + "s"); stems.push(word + "es"); }
  if (word.endsWith("ing")) stems.push(word.slice(0, -3));
  if (word.endsWith("ed")) stems.push(word.slice(0, -2));
  return stems.some((s) => s.length >= 3 && containsTerm(normText, s));
}

// ───────────────────── keyword extraction ─────────────────────

// Pull frequent free-text terms from the JD that aren't in our dictionaries.
function extractFreeKeywords(jdText, excludeNorm) {
  const words = jdText.toLowerCase().replace(/[^a-z0-9'’\- ]/g, " ").split(/\s+/);
  const counts = new Map();
  for (let w of words) {
    w = w.replace(/^['’\-]+|['’\-]+$/g, "");
    if (w.length < 4 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  // bigrams
  const bigramCounts = new Map();
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].replace(/^['’\-]+|['’\-]+$/g, "");
    const b = words[i + 1].replace(/^['’\-]+|['’\-]+$/g, "");
    if (a.length < 3 || b.length < 3 || STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    if (/^\d+$/.test(a) || /^\d+$/.test(b)) continue;
    const bg = a + " " + b;
    bigramCounts.set(bg, (bigramCounts.get(bg) || 0) + 1);
  }

  const picked = [];
  // bigrams first (more specific), need to appear 2+ times
  [...bigramCounts.entries()]
    .filter(([t, c]) => c >= 2 && !excludeNorm.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([t]) => picked.push(t));
  // single words appearing 2+ times; skip words already part of a matched dictionary
  // term (e.g. "google" when "Google Ads" already matched) to avoid noisy duplicates
  const partOfSkill = (w) => {
    for (const term of excludeNorm) {
      if (term === w || term.split(/[\s/.-]+/).includes(w)) return true;
    }
    return false;
  };
  [...counts.entries()]
    .filter(([t, c]) => c >= 2 && !partOfSkill(t) && !picked.some((p) => p.includes(t)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([t]) => picked.push(t));
  return picked;
}

// ───────────────────── resume health checks ─────────────────────

function runChecks(resumeRaw, normResume) {
  const checks = [];
  const wordCount = resumeRaw.trim().split(/\s+/).filter(Boolean).length;

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(resumeRaw);
  checks.push({
    ok: hasEmail,
    label: "Contact email",
    detail: hasEmail ? "Email address found." : "No email address detected — make sure your contact info is in the resume text (not only in a header image, which ATS software can't read).",
  });

  const hasPhone = /(\+?\d[\d\s().-]{8,}\d)/.test(resumeRaw);
  checks.push({
    ok: hasPhone,
    label: "Phone number",
    detail: hasPhone ? "Phone number found." : "No phone number detected. Add one in plain text near the top.",
  });

  checks.push({
    ok: wordCount >= 300 && wordCount <= 900,
    label: "Length",
    detail: wordCount < 300
      ? `Your resume is ${wordCount} words — that's on the thin side. Aim for 400–800 words with concrete accomplishments.`
      : wordCount > 900
        ? `Your resume is ${wordCount} words — recruiters spend ~7 seconds on a first pass. Consider trimming to the most relevant 400–800 words.`
        : `${wordCount} words — a good length.`,
  });

  const numbers = (resumeRaw.match(/(\$[\d,.]+|\d+(\.\d+)?%|\b\d{2,}\b)/g) || []).length;
  checks.push({
    ok: numbers >= 5,
    label: "Measurable results",
    detail: numbers >= 5
      ? `Found ${numbers} numbers/metrics — great. Quantified results make bullets credible.`
      : `Only ${numbers} number(s) found. Add metrics: "increased sales 32%", "managed $50K budget", "supported 200+ customers".`,
  });

  const lines = resumeRaw.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 20);
  let verbStarts = 0;
  for (const line of lines) {
    const first = line.replace(/^[-•*●▪◦‣·\s]+/, "").split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
    if (first && ACTION_VERBS.includes(first)) verbStarts++;
  }
  const verbRatio = lines.length ? verbStarts / lines.length : 0;
  checks.push({
    ok: verbRatio >= 0.25 || verbStarts >= 6,
    label: "Action verbs",
    detail: verbRatio >= 0.25 || verbStarts >= 6
      ? `${verbStarts} lines start with strong action verbs — nice.`
      : `Few lines start with strong action verbs. Begin bullets with words like "Led", "Built", "Increased", "Delivered" instead of "Responsible for".`,
  });

  const pronouns = (normResume.match(/(^|[^a-z])(i|me|my|myself)([^a-z]|$)/g) || []).length;
  checks.push({
    ok: pronouns <= 2,
    label: "First-person pronouns",
    detail: pronouns <= 2
      ? "Minimal first-person pronouns — good resume style."
      : `Found ${pronouns} uses of "I/me/my". Resumes conventionally drop pronouns: "Led a team of 5" rather than "I led a team of 5".`,
  });

  const found = CLICHES.filter((c) => containsTerm(normResume, c));
  checks.push({
    ok: found.length === 0,
    label: "Clichés & buzzwords",
    detail: found.length === 0
      ? "No tired buzzwords detected."
      : `Found: ${found.slice(0, 5).map((f) => `"${f}"`).join(", ")}. Replace with a concrete example that proves the trait instead.`,
  });

  const respFor = (normResume.match(/responsible for/g) || []).length;
  checks.push({
    ok: respFor <= 1,
    label: '"Responsible for"',
    detail: respFor <= 1
      ? 'Little or no "responsible for" filler — good.'
      : `"Responsible for" appears ${respFor} times. Swap each for what you actually did and achieved.`,
  });

  return checks;
}

// ───────────────────────── analysis ─────────────────────────

function analyze(resumeRaw, jdRaw) {
  const normResume = normalize(resumeRaw);
  const normJD = normalize(jdRaw);

  // Hard skills the JD asks for
  const jdHard = HARD_SKILLS.filter((s) => skillIn(normJD, s));
  const jdSoft = SOFT_SKILLS.filter((s) => skillIn(normJD, s));

  const hardMatched = jdHard.filter((s) => skillIn(normResume, s));
  const hardMissing = jdHard.filter((s) => !skillIn(normResume, s));
  const softMatched = jdSoft.filter((s) => skillIn(normResume, s));
  const softMissing = jdSoft.filter((s) => !skillIn(normResume, s));

  // Free-text keywords (exclude anything already covered by dictionary hits)
  const excludeNorm = new Set();
  [...jdHard, ...jdSoft].forEach((s) => {
    excludeNorm.add(s.name.toLowerCase());
    s.syn.forEach((x) => excludeNorm.add(x.toLowerCase()));
  });
  const freeKeywords = extractFreeKeywords(jdRaw, excludeNorm);
  const freeMatched = freeKeywords.filter((k) => wordIn(normResume, k));
  const freeMissing = freeKeywords.filter((k) => !wordIn(normResume, k));

  const checks = runChecks(resumeRaw, normResume);
  const checksPassed = checks.filter((c) => c.ok).length;

  // Weighted score. Categories with nothing to match redistribute their weight.
  const parts = [];
  if (jdHard.length) parts.push({ w: 0.55, v: hardMatched.length / jdHard.length });
  // free-keyword weight scales with how many keywords were found, so one or two
  // leftover terms can't dominate the score
  if (freeKeywords.length) parts.push({ w: 0.25 * Math.min(1, freeKeywords.length / 6), v: freeMatched.length / freeKeywords.length });
  if (jdSoft.length) parts.push({ w: 0.10, v: softMatched.length / jdSoft.length });
  parts.push({ w: 0.10, v: checksPassed / checks.length });
  const totalW = parts.reduce((a, p) => a + p.w, 0);
  const score = Math.round((parts.reduce((a, p) => a + p.w * p.v, 0) / totalW) * 100);

  return {
    score,
    hardMatched, hardMissing,
    softMatched, softMissing,
    freeMatched, freeMissing,
    checks,
  };
}

// ───────────────────────── rendering ─────────────────────────

const $ = (id) => document.getElementById(id);

function chipList(items, kind) {
  if (!items.length) return '<p class="empty-note">None found in this job description.</p>';
  return '<div class="chips">' + items.map((it) => {
    const label = typeof it === "string" ? it : it.name;
    return `<button class="chip ${kind}" data-copy="${escapeHtml(label)}" title="Click to copy">${escapeHtml(label)}</button>`;
  }).join("") + "</div>";
}

function scoreMessage(score) {
  if (score >= 80) return ["Excellent match", "Your resume aligns strongly with this job. Polish the few gaps below and apply with confidence."];
  if (score >= 60) return ["Good match", "You're close. Weave the missing keywords below into your bullets where they're genuinely true."];
  if (score >= 40) return ["Partial match", "There's a real gap. Add the missing skills you actually have — they may be in your head but not on the page."];
  return ["Low match", "Your resume doesn't yet speak this job's language. Mirror the job description's terms for the skills you genuinely have."];
}

let lastResult = null;

function render(result) {
  lastResult = result;
  const { score } = result;

  // gauge
  const circle = $("gauge-fg");
  const circumference = 2 * Math.PI * 84;
  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = circumference;
  const color = score >= 80 ? "var(--good)" : score >= 60 ? "var(--ok)" : score >= 40 ? "var(--warn)" : "var(--bad)";
  circle.style.stroke = color;

  const [headline, advice] = scoreMessage(score);
  $("score-headline").textContent = headline;
  $("score-advice").textContent = advice;

  // animate (setTimeout/setInterval rather than rAF so the final value always
  // lands even if the tab is backgrounded mid-animation)
  setTimeout(() => {
    circle.style.strokeDashoffset = circumference * (1 - score / 100);
  }, 60);
  const el = $("score-number");
  let cur = 0;
  if (window.__scoreTimer) clearInterval(window.__scoreTimer);
  if (window.__scoreFinal) clearTimeout(window.__scoreFinal);
  window.__scoreTimer = setInterval(() => {
    cur += Math.max(1, Math.round(score / 25));
    if (cur >= score) {
      el.textContent = score + "%";
      clearInterval(window.__scoreTimer);
    } else {
      el.textContent = cur + "%";
    }
  }, 18);
  // hard stop: whatever happens with timer throttling, land on the real score
  window.__scoreFinal = setTimeout(() => {
    el.textContent = score + "%";
    clearInterval(window.__scoreTimer);
  }, 1500);

  $("stat-hard").textContent = `${result.hardMatched.length}/${result.hardMatched.length + result.hardMissing.length}`;
  $("stat-soft").textContent = `${result.softMatched.length}/${result.softMatched.length + result.softMissing.length}`;
  $("stat-other").textContent = `${result.freeMatched.length}/${result.freeMatched.length + result.freeMissing.length}`;
  $("stat-checks").textContent = `${result.checks.filter((c) => c.ok).length}/${result.checks.length}`;

  $("hard-missing").innerHTML = chipList(result.hardMissing, "miss");
  $("hard-matched").innerHTML = chipList(result.hardMatched, "hit");
  $("soft-missing").innerHTML = chipList(result.softMissing, "miss");
  $("soft-matched").innerHTML = chipList(result.softMatched, "hit");
  $("other-missing").innerHTML = chipList(result.freeMissing, "miss");
  $("other-matched").innerHTML = chipList(result.freeMatched, "hit");

  $("checks-list").innerHTML = result.checks.map((c) => `
    <li class="check ${c.ok ? "pass" : "fail"}">
      <span class="check-icon">${c.ok ? "✓" : "✗"}</span>
      <div><strong>${escapeHtml(c.label)}</strong><p>${escapeHtml(c.detail)}</p></div>
    </li>`).join("");

  $("results").hidden = false;
  if (window.applyResultsGate) window.applyResultsGate();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ───────────────────────── file parsing ─────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

async function extractFileText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return file.text();
  }
  if (name.endsWith(".pdf")) {
    if (!window.pdfjsLib) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      out.push(content.items.map((i) => i.str).join(" "));
    }
    return out.join("\n");
  }
  if (name.endsWith(".docx")) {
    if (!window.mammoth) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    }
    const buf = await file.arrayBuffer();
    const res = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return res.value;
  }
  throw new Error("Unsupported file type. Use PDF, DOCX, or TXT — or just paste your resume text.");
}

// ───────────────────────── wire-up ─────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const resumeBox = $("resume-input");
  const jdBox = $("jd-input");

  // file upload
  $("file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = $("file-status");
    status.textContent = "Reading " + file.name + "…";
    try {
      const text = await extractFileText(file);
      resumeBox.value = text.trim();
      status.textContent = "✓ Loaded " + file.name + " (parsed in your browser — never uploaded)";
      resumeBox.dispatchEvent(new Event("input"));
    } catch (err) {
      status.textContent = "⚠ " + err.message;
    }
    e.target.value = "";
  });

  // word counters
  const counter = (box, el) => {
    const n = box.value.trim().split(/\s+/).filter(Boolean).length;
    $(el).textContent = n ? n + " words" : "";
  };
  resumeBox.addEventListener("input", () => counter(resumeBox, "resume-count"));
  jdBox.addEventListener("input", () => counter(jdBox, "jd-count"));

  // analyze
  $("analyze-btn").addEventListener("click", () => {
    const resume = resumeBox.value.trim();
    const jd = jdBox.value.trim();
    const err = $("input-error");
    err.textContent = "";
    if (resume.split(/\s+/).length < 30) {
      err.textContent = "Please paste your full resume (at least ~30 words).";
      resumeBox.focus();
      return;
    }
    if (jd.split(/\s+/).length < 20) {
      err.textContent = "Please paste the full job description (at least ~20 words).";
      jdBox.focus();
      return;
    }
    render(analyze(resume, jd));
  });

  // sample data
  $("sample-btn").addEventListener("click", () => {
    resumeBox.value = SAMPLE_RESUME;
    jdBox.value = SAMPLE_JD;
    resumeBox.dispatchEvent(new Event("input"));
    jdBox.dispatchEvent(new Event("input"));
    $("analyze-btn").click();
  });

  // chip copy
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    navigator.clipboard?.writeText(chip.dataset.copy);
    const old = chip.textContent;
    chip.textContent = "Copied!";
    setTimeout(() => { chip.textContent = old; }, 900);
  });

  // copy all missing
  $("copy-missing").addEventListener("click", () => {
    if (!lastResult) return;
    const all = [
      ...lastResult.hardMissing.map((s) => s.name),
      ...lastResult.freeMissing,
      ...lastResult.softMissing.map((s) => s.name),
    ];
    navigator.clipboard?.writeText(all.join(", "));
    const btn = $("copy-missing");
    btn.textContent = "Copied " + all.length + " keywords!";
    setTimeout(() => { btn.textContent = "Copy all missing keywords"; }, 1500);
  });

  // re-analyze shortcut
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") $("analyze-btn").click();
  });

  // FAQ accordions handled natively by <details>
});

// ───────────────────────── sample data ─────────────────────────

const SAMPLE_RESUME = `Jordan Avery
jordan.avery@email.com | (555) 201-7788 | linkedin.com/in/jordanavery

MARKETING SPECIALIST

Experience

Digital Marketing Specialist — Brightline Goods, 2023–present
- Led email marketing program across 6 automated flows in Klaviyo, growing list revenue 41% year over year
- Managed $18K/month Google Ads and Meta Ads budget, reducing cost per acquisition 27%
- Built monthly performance dashboards in Google Analytics and Looker Studio for leadership
- Created SEO content strategy that increased organic traffic 65% in 12 months
- Collaborated with design team on landing pages, improving conversion rate from 1.9% to 3.1%

Marketing Coordinator — Halcyon Fitness, 2021–2023
- Coordinated social media marketing across Instagram and TikTok, growing followers from 4K to 38K
- Wrote copy for 120+ email campaigns with average open rate of 34%
- Analyzed campaign data in Excel and presented weekly reports to the marketing manager
- Organized 12 community events generating 800+ qualified leads

Education
B.A. Communications, State University, 2021

Skills
Google Analytics, Google Ads, Klaviyo, SEO, copywriting, A/B testing, Canva, Excel`;

const SAMPLE_JD = `Growth Marketing Manager

We're looking for a Growth Marketing Manager to own our paid and lifecycle channels.

Responsibilities
- Own paid acquisition across Google Ads and Meta Ads, managing a six-figure annual budget
- Build and optimize email marketing and SMS lifecycle flows in Klaviyo
- Run A/B testing across landing pages and creative to improve conversion rate
- Own reporting: build dashboards in Google Analytics (GA4) and Looker Studio
- Partner with content team on SEO strategy and content marketing
- Present performance and forecasting to leadership monthly

Requirements
- 3+ years in growth marketing or digital marketing
- Hands-on experience with Google Ads, Meta Ads, and Google Analytics
- Experience with marketing automation (Klaviyo or similar)
- Strong analytical skills; comfortable with Excel and SQL
- Experience with HubSpot a plus
- Excellent communication and project management skills
- Comfortable in a fast-paced environment`;
