# Turning on payments (your one remaining task, ~10 minutes)

Everything code-side is already deployed. Payments need an account in **your**
name (any payment provider legally requires your identity and bank details),
which is the one thing that can't be done for you. Here's the shortest path:

## Recommended: Lemon Squeezy (or Gumroad — same idea)

1. Sign up at lemonsqueezy.com (or gumroad.com) and connect your bank/PayPal.
2. Create a product: **"ResumeRadar Pro"**, type *digital product*, price **$9**
   (one-time, not subscription).
3. In the product's confirmation/receipt settings, paste this as the content
   buyers receive after purchase:

   > Thanks for supporting ResumeRadar! Your Pro unlock code is:
   > **RADAR-PRO-0358OKSX**
   > Enter it in the unlock box on the site and the full PDF report is yours
   > for life. (Code is in PRO-UNLOCK-CODE.txt on your machine — paste the
   > real one if this placeholder doesn't match.)

4. Copy the product's **payment link** (looks like
   `https://yourstore.lemonsqueezy.com/buy/...`).
5. Open `config.js` in this folder, paste the link into `paymentLink: ""`.
6. Push the change:
   ```
   git add config.js
   git commit -m "Enable Pro payments"
   git push
   ```
   (Or just ask Claude to do steps 5–6.)

The moment that deploys, the site automatically switches from
"report is free" to "report is a $9 Pro feature" — the PRO badge, paywall
modal, buy button, and unlock-code box all appear on their own.

## Optional extras

- **Tip jar:** create a Buy Me a Coffee page and paste its URL into
  `tipLink` in `config.js` — a "☕ Support this tool" link appears in the footer.
- **Stronger licensing:** if you used Lemon Squeezy, enable *license keys* on
  the product and paste your store + product IDs into the `lemonSqueezy`
  section of `config.js`. Then every buyer's unique key validates
  automatically (instead of the single shared code).

## Why the scanner itself stays free

The entire distribution plan (MARKETING.md) is built on "free, unlimited,
private alternative to a $50/month tool." Paywalling the scan would kill the
posts that bring traffic. Free scan → traffic → a slice buys the $9 report.
