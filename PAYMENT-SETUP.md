# Turning on payments (your one remaining task, ~10 minutes)

The paywall is fully built and deployed but **dormant**: while `paymentLink` in
`config.js` is empty, the site behaves as a free tool. The moment you paste a
payment link and push, the site automatically switches to:

- Scanning stays free (anyone can paste a resume + job description and hit Check)
- **Results appear blurred behind a one-time $5 unlock**
- Buyers get a license/unlock code — entering it reveals results and unlocks
  unlimited scans + the PDF report **forever, on any device** (the code is
  their "account"; it's saved in their browser so they stay signed in)
- A "★ Pro / sign out" chip appears in the header for unlocked users

Payments need an account in **your** name (every provider legally requires
your identity and bank details), which is the one thing that can't be done
for you. Shortest path:

## Recommended: Lemon Squeezy (or Gumroad — same idea)

1. Sign up at lemonsqueezy.com (or gumroad.com) and connect your bank/PayPal.
2. Create a product: **"ResumeRadar — Lifetime Unlock"**, digital product,
   price **$5** one-time (not subscription).
3. Best option — enable **license keys** on the product, then put your store ID
   and product ID into the `lemonSqueezy` section of `config.js`. Every buyer
   gets a unique key that validates automatically (and you can revoke leaked
   keys from the Lemon Squeezy dashboard).
   Simple option — put the shared unlock code from `PRO-UNLOCK-CODE.txt`
   (local file on your machine, never committed) in the product's
   receipt/thank-you message.
4. Copy the product's **payment link** (`https://yourstore.lemonsqueezy.com/buy/...`).
5. Paste it into `paymentLink: ""` in `config.js`.
6. Push:
   ```
   git add config.js
   git commit -m "Enable payments"
   git push
   ```
   (Or just ask Claude to do steps 5–6.)

## Important: update your forum posts when you flip this on

The current MARKETING.md templates pitch a "free tool" — that's only honest
while the gate is off. Once payments are on, use the paywall-era template at
the bottom of MARKETING.md ("$5 once vs Jobscan's $50/month" — still a strong
pitch, communities respect honest one-time pricing far more than subscriptions).

## Honest limitations

- The gate is client-side (this site has no server). A tech-savvy user could
  read results from the page source. For a $5 product at this stage that's
  acceptable leakage; real enforcement would need a backend later.
- The shared-code option means one leaked code unlocks everyone — prefer
  Lemon Squeezy license keys if you expect real volume.

## Optional

- **Tip jar:** paste a Buy Me a Coffee URL into `tipLink` in `config.js` —
  a "☕ Support this tool" footer link appears.
