// ─── ResumeRadar monetization config ───
// The site works as a pure free tool until you fill this in.
// Setup (10 min): create a product on Lemon Squeezy or Gumroad ($9 one-time,
// "ResumeRadar Pro"), then paste your payment link below and redeploy.
//
// Unlock options (either works, both can be on):
//  A) lemonSqueezy: paste your store/product IDs — buyers' license keys are
//     verified automatically against Lemon Squeezy's public license API.
//  B) unlockCodeHash: SHA-256 hash of a secret unlock code. Put the code itself
//     in your payment provider's "thank you / receipt" message so buyers get it
//     after checkout. Generate the hash by running this in any browser console:
//     crypto.subtle.digest("SHA-256", new TextEncoder().encode("YOUR-CODE"))
//       .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))

const PRO_CONFIG = {
  price: "$9",
  // Paste your Lemon Squeezy / Gumroad / Stripe payment link here.
  // While this is empty, all Pro buttons are hidden and the site is 100% free.
  paymentLink: "",

  // Option A — Lemon Squeezy license validation (recommended)
  lemonSqueezy: {
    storeId: "",   // e.g. "12345"
    productId: "", // e.g. "67890"
  },

  // Option B — offline unlock code (works with any payment provider).
  // The matching plaintext code lives in PRO-UNLOCK-CODE.txt on the owner's
  // machine only (gitignored) — put it in your payment provider's receipt page.
  unlockCodeHash: "2ded307270e69bff3c5ee4a850f12b950b63c88de33143fb5a9cccd0f7efbd6a",

  // Optional tip-jar link shown in the footer (Buy Me a Coffee / Ko-fi).
  tipLink: "",
};
