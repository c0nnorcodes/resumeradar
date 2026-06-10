# 🎯 ResumeRadar

**Free, unlimited, 100%-private resume ↔ job description match checker.**

Paste a resume and a job description → get a match score, the exact missing keywords (hard skills, soft skills, and posting-specific terms), and an 8-point resume health check. Everything runs in the visitor's browser — no server, no database, no accounts, no data ever leaves their device.

It's a free alternative to Jobscan ($49.95/mo, 5 free scans) with a privacy angle Jobscan can't match.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire page (hero, tool, how-it-works, FAQ) |
| `styles.css` | All styling, mobile-responsive |
| `app.js` | Analysis engine + UI logic |
| `skills.js` | Dictionaries: 359 hard skills w/ synonyms, 30 soft skills, action verbs, clichés, stopwords |
| `MARKETING.md` | Where and how to post it (the zero-sales distribution plan) |

PDF/DOCX parsing uses pdf.js and mammoth.js loaded from CDN **only when a user uploads a file** — pasting text works fully offline.

## Run locally

Just open `index.html` in a browser. (File upload needs a local server in some browsers: `npx http-server . -p 4173`.)

## Deploy free (pick one, ~2 minutes)

**Netlify (easiest):** go to [app.netlify.com/drop](https://app.netlify.com/drop), drag this folder onto the page. Done — you get a live URL instantly. Free tier is permanent.

**GitHub Pages:** create a repo, push these files, then Settings → Pages → deploy from `main` branch root.

**Cloudflare Pages:** [pages.cloudflare.com](https://pages.cloudflare.com) → create project → direct upload → drag folder.

Optionally buy a domain (~$10/yr) and point it at the deploy — a real domain noticeably improves trust and shareability, but the free subdomain works to start.

## Monetization later (optional, still no sales)

- A small "Buy me a coffee" link in the footer
- One tasteful affiliate link (resume-writing services, job boards) in the FAQ
- Keep the core tool free forever — the free+private positioning **is** the marketing

## Honest limitations

- Keyword matching is dictionary + frequency based, not semantic — it can miss niche industry jargon (the "Other keywords" section catches most of it via repetition analysis).
- Image-based PDFs (scans, design-tool exports) can't be parsed; the FAQ tells users to paste text instead.
