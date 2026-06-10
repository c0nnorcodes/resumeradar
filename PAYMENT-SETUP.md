# Payments: current state and your one remaining task

## How the site works now (accounts are LIVE)

- Anyone can scan for free, unlimited times.
- **Viewing results requires an account** (email + password, instant — no
  confirmation email). Accounts live in Supabase project `resumeradar`
  (org GreenLit): https://supabase.com/dashboard/project/fcuaaqvewgerfucbeybk
- Each account has a `paid` flag (database table `profiles`, protected by RLS —
  users can read their own flag but can never set it themselves).
- While `paymentLink` in `config.js` is empty (current state): a free account
  is enough to see results.
- Once `paymentLink` is set: signed-in users additionally need `paid = true`.
  They see a "$5 one-time unlock" card with a checkout button (their email
  prefilled) and an "I've paid — refresh my account" button. The unlock follows
  the account — sign in anywhere, results are unlocked.

## Your one remaining task (~10 min): create the payment account

1. Sign up at **lemonsqueezy.com**, connect your bank/PayPal.
2. Create product: "ResumeRadar — Lifetime Unlock", digital, **$5 one-time**.
3. In Lemon Squeezy → Settings → Webhooks: add a webhook pointing to
   `https://fcuaaqvewgerfucbeybk.supabase.co/functions/v1/payment-webhook`
   with event **order_created**, and copy the **signing secret**.
4. Tell Claude (or do it yourself):
   - Deploy the webhook (code is ready in `supabase/functions/payment-webhook/`):
     ```
     npx supabase login
     npx supabase functions deploy payment-webhook --project-ref fcuaaqvewgerfucbeybk --no-verify-jwt
     npx supabase secrets set LS_WEBHOOK_SECRET=<signing secret> --project-ref fcuaaqvewgerfucbeybk
     ```
   - Paste the product's payment link into `paymentLink` in `config.js`,
     commit, push.

From then on: buyer pays → Lemon Squeezy calls the webhook → account flips to
`paid = true` → their results unlock everywhere, forever. Fully automatic.

## Manual operations (Supabase SQL editor, or ask Claude)

- Comp a user / fix a payment made with a different email:
  `update public.profiles set paid = true where email = 'their@email.com';`
- See signups: `select email, paid, created_at from public.profiles order by created_at desc;`

## Notes

- Email confirmation is disabled (Supabase free tier only sends ~2 emails/hour,
  which would break signups). Password reset emails share that limit — if the
  site takes off, add a custom SMTP provider (Resend free tier works) in
  Supabase → Auth → SMTP.
- A buyer who checks out with a different email than their account won't
  auto-unlock — the lock card tells them to use the same email; fix stragglers
  with the SQL above.
- `SUPABASE-NOTES.txt` (local only, gitignored) has the database password and
  pooler host (aws-1-us-east-1.pooler.supabase.com, user postgres.fcuaaqvewgerfucbeybk).
- Test account exists: rr-test-account@mailinator.com (paid=true, used for
  end-to-end verification). Safe to delete.
