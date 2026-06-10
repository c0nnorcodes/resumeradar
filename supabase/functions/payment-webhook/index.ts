// Lemon Squeezy webhook → marks the buyer's account as paid.
// Deploy: npx supabase functions deploy payment-webhook --project-ref fcuaaqvewgerfucbeybk --no-verify-jwt
// Secrets: npx supabase secrets set LS_WEBHOOK_SECRET=<signing secret from Lemon Squeezy webhook settings>
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("LS_WEBHOOK_SECRET");
  if (!secret) return new Response("webhook not configured", { status: 503 });

  const raw = await req.text();

  // verify Lemon Squeezy HMAC-SHA256 signature
  const sig = req.headers.get("x-signature") ?? "";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== sig.toLowerCase()) return new Response("bad signature", { status: 401 });

  const evt = JSON.parse(raw);
  if (evt?.meta?.event_name === "order_created") {
    const email = evt?.data?.attributes?.user_email?.toLowerCase();
    if (email) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error } = await admin.from("profiles").update({ paid: true }).ilike("email", email);
      if (error) return new Response("db error", { status: 500 });
    }
  }
  return new Response("ok");
});
