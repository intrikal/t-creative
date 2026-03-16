# Cloudflare Turnstile — Bot Protection Setup

Cloudflare Turnstile protects all public unauthenticated forms from bots and spam without degrading UX. It is a drop-in replacement for reCAPTCHA — do **not** add reCAPTCHA alongside it.

---

## How it works

Turnstile runs in **Managed** mode. Cloudflare silently scores each visitor using browser fingerprinting, interaction patterns, and IP reputation. Most real users pass automatically with no visible UI. A checkbox challenge only appears when Cloudflare is genuinely uncertain. The server verifies every token before touching the database or sending email.

**Protected endpoints:**

| Endpoint                         | File                                               |
| -------------------------------- | -------------------------------------------------- |
| Contact form                     | `app/contact/actions.ts`                           |
| Guest booking request            | `app/api/book/guest-request/route.ts`              |
| Guest waitlist                   | `app/api/book/waitlist/route.ts` (guest path only) |
| Inline booking page contact form | `app/api/chat/fallback/route.ts`                   |

Authenticated users on the waitlist route bypass Turnstile — they are already verified by Supabase session.

---

## One-time setup

### 1. Create a Turnstile site in Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add site**
2. Enter a name (e.g. `T Creative Studio`)
3. Add your domain: `tcreativestudio.com`
4. Widget type: **Managed** (recommended — invisible by default)
5. Click **Create** — Cloudflare shows you both keys immediately

### 2. Add the keys to your environment

```bash
# .env (local) — never commit this file
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...   # shown in Cloudflare as "Site Key"
TURNSTILE_SECRET_KEY=0x...             # shown in Cloudflare as "Secret Key"
```

For production (Vercel):

- **Project Settings → Environment Variables**
- Add both keys, scoped to **Production** (and **Preview** if desired)

### 3. Add your preview/staging domain (optional)

If you use Vercel preview deployments, add the preview domain pattern in Cloudflare → Turnstile → your site → **Domains** tab. Turnstile will reject tokens from domains not listed there.

Alternatively, use Cloudflare's test keys for Preview environments:

```
# Test keys — always pass verification, safe for CI/preview
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

---

## How the code is structured

**Server-side verification** — [`lib/turnstile.ts`](../lib/turnstile.ts)

Single shared utility called by every protected handler. In development without a `TURNSTILE_SECRET_KEY` set, verification is skipped automatically so local dev works without Cloudflare credentials.

**Frontend widget** — `@marsidev/react-turnstile`

The `<Turnstile>` component renders inside each form. `onSuccess` stores the token in state; `onExpire` clears it. The submit button is disabled until `onSuccess` fires. The token is passed in the request body alongside the form data.

---

## Rotating keys

If you suspect a key has been compromised:

1. Cloudflare → Turnstile → your site → **Rotate secret key**
2. Update `TURNSTILE_SECRET_KEY` in Vercel environment variables
3. Redeploy — the site key does not change, so no frontend redeploy is strictly required, but redeploy anyway to be safe
