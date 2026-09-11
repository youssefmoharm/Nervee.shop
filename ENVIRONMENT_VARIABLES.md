# Environment Variables & Secrets Management

## Overview

NERVE uses environment variables to manage configuration and secrets. This document explains how they're organized, which ones are safe to commit, and how to manage production secrets.

## Key Principle: VITE_ = PUBLIC

Anything prefixed with `VITE_` is bundled into the browser JavaScript bundle and is **visible to anyone**. Never put secrets there.

```js
// ❌ WRONG — This will be visible in the browser
VITE_SECRET_API_KEY=sk_live_abc123

// ✅ RIGHT — Server secrets use no prefix
RESEND_API_KEY=re_abc123  // Set in Supabase secrets, not in .env
```

## Environment Variables Reference

### Frontend (Vite) — PUBLIC

These are safe to commit (use placeholders):

| Variable | Required | Type | Location |
|----------|----------|------|----------|
| `VITE_SUPABASE_URL` | ✓ | URL | `.env`, Vercel |
| `VITE_SUPABASE_ANON_KEY` | ✓ | String | `.env`, Vercel |
| `VITE_ENV` | ✓ | `development`\|`staging`\|`production` | `.env`, Vercel |
| `VITE_APP_URL` | ✓ | URL | `.env`, Vercel |
| `VITE_SUPPORT_EMAIL` | ✓ | Email | `.env`, Vercel |
| `VITE_SENTRY_DSN` | ✗ | URL | Vercel only (production) |
| `VITE_GA_ID` | ✗ | String | Vercel only (production) |
| `VITE_META_PIXEL_ID` | ✗ | String | Vercel only (production) |
| `VITE_CRISP_ID` | ✗ | String | Optional |
| `VITE_SNAPCHAT_LENS_ID` | ✗ | String | Optional |

**Development**: Use placeholders in `.env` and `.env.local`  
**Production**: Set real values in Vercel (`Settings → Environment Variables → Production`)

### Backend Secrets — SERVER ONLY

These are **never** prefixed with `VITE_`. Set in Supabase only, never in `.env` files:

```bash
# Set in Supabase (not in git)
supabase secrets set RESEND_API_KEY=re_abc123
supabase secrets set GOOGLE_GEMINI_API_KEY=sk_xyz789
supabase secrets set PAYMOB_API_KEY=...
supabase secrets set PAYMOB_HMAC_SECRET=...

# List all secrets
supabase secrets list
```

| Secret | Purpose | Service | Notes |
|--------|---------|---------|-------|
| `RESEND_API_KEY` | Transactional emails | Resend.com | Required for order emails |
| `RESEND_FROM_EMAIL` | Email sender | Resend.com | e.g., `orders@nerveey.shop` |
| `STORE_URL` | Base URL | Resend | Used in email templates |
| `GOOGLE_GEMINI_API_KEY` | AI chatbot | Google AI Studio | Optional (P1) |
| `OPENAI_API_KEY` | AI (alternate) | OpenAI | Alias for Gemini |
| `PAYMOB_API_KEY` | Card payments | Paymob | Optional (P1) |
| `PAYMOB_HMAC_SECRET` | Payment verification | Paymob | Optional (P1) |
| `PAYMOB_IFRAME_ID` | Payment form | Paymob | Optional (P1) |
| `PAYMOB_INTEGRATION_ID` | Payment integration | Paymob | Optional (P1) |
| `CRON_SECRET` | Job scheduling | Custom | Optional; protects scheduler endpoints |

### Auto-Injected by Supabase

These are **automatically available** inside Edge Functions. Never set them yourself:

- `SUPABASE_URL` — Service role database URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (super-user for DB)

## How to Set Up

### Local Development

1. **Copy `.env.example` to `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` with local Supabase credentials:**
   ```env
   VITE_SUPABASE_URL=https://gfmxvvjqlhrnmidutjwx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW
   ```

3. **Use `.env.local` for personal overrides** (gitignored):
   ```env
   VITE_APP_URL=http://localhost:5173  # Local dev override
   ```

### Production (Vercel)

1. **Set public variables in Vercel:**
   ```
   Settings → Environment Variables
   Select: Production + Preview (not Development)
   ```
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ENV=production`
   - `VITE_APP_URL` (production domain)
   - `VITE_SENTRY_DSN` (real DSN, not placeholder)
   - `VITE_GA_ID` (real ID)
   - `VITE_META_PIXEL_ID` (real ID)

2. **Set server secrets in Supabase:**
   ```bash
   supabase secrets set RESEND_API_KEY=re_abc123
   supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@nerveey.shop>"
   supabase secrets set STORE_URL="https://www.nerveey.shop"
   supabase secrets set GOOGLE_GEMINI_API_KEY=sk_xyz789
   ```

3. **Verify:**
   ```bash
   supabase secrets list
   ```

## Security Checklist

- [ ] `.env` contains **no real production secrets** (only Supabase dev keys)
- [ ] `.env.local` is in `.gitignore` (personal overrides)
- [ ] All `VITE_` variables are safe to expose (no API keys)
- [ ] Production secrets set in Supabase only (not Vercel)
- [ ] Real DSN/API keys never committed to git
- [ ] Vercel environment variables match production requirements
- [ ] Edge Functions can access `Deno.env.get('KEY')` for secrets
- [ ] Rotation plan documented (update in Supabase if keys compromised)

## Common Issues

### "Supabase URL not configured"

```
⚠️  [supabase] VITE_SUPABASE_URL not set — running in demo/mock mode
```

**Solution**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`

### "Email not sending"

**Cause**: `RESEND_API_KEY` not set in Supabase secrets

**Solution**:
```bash
supabase secrets set RESEND_API_KEY=re_abc123
supabase secrets set STORE_URL=https://www.nerveey.shop
```

### "Analytics not tracking"

**Cause**: `VITE_GA_ID` not set for production

**Solution**: Set in Vercel → Settings → Environment Variables (Production)

## What's in Git

✅ **SAFE TO COMMIT:**
- `.env.example` — Template with instructions
- `.env` — Dev/staging credentials only (Supabase test keys)
- `.env.local` — Gitignored anyway
- Code that reads env vars (`import.meta.env.VITE_*`)

❌ **NEVER COMMIT:**
- Real API keys (`sk_live_`, `re_prod_`, etc.)
- Production Sentry DSN
- Real database credentials
- Paymob secrets

## References

- [Vite: Env Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase: Secrets Management](https://supabase.com/docs/guides/local-development/cli/secrets)
- [Resend: API Keys](https://resend.com/docs/api-reference/api-keys)
- [OWASP: Secrets Management](https://owasp.org/www-community/Sensitive_Data_Exposure)
