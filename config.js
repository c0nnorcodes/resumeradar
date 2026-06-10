// ─── ResumeRadar configuration ───

// Supabase backend (auth + paid status). Publishable key is safe in the browser;
// data access is protected by Row Level Security on the server.
const SUPA_CONFIG = {
  url: "https://fcuaaqvewgerfucbeybk.supabase.co",
  key: "sb_publishable_hb11t6ICDmqYJoIF-834KA_FxWXS_vT",
};

const PRO_CONFIG = {
  price: "$5",

  // Paste your Lemon Squeezy / Gumroad / Stripe payment link here.
  // While empty: visitors only need a FREE account to see results.
  // Once set: results additionally require paid=true on the user's profile
  // (set automatically by the payment webhook — see PAYMENT-SETUP.md).
  paymentLink: "",

  // Optional tip-jar link shown in the footer (Buy Me a Coffee / Ko-fi).
  tipLink: "",
};
