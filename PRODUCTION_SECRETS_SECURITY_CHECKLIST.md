# NERVE — Production Secrets Security Checklist

## ✅ Completed: P0.8 Secrets Exposure Audit

### Changes Made

1. **New Module:** `supabase/functions/_shared/secure-logging.ts`
   - Centralized safe logging utilities
   - Automatic redaction of secrets in error messages
   - Prevents accidental leakage of API keys, tokens, connections strings
   - Use `logError()`, `logInfo()`, `logWarn()`, `redactObject()` instead of `console.log()`

2. **Security Principles**
   ```typescript
   // ❌ NEVER DO THIS:
   console.error('Supabase error:', error); // might include connection strings
   throw new Error(`Failed: ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`); // EXPOSES SECRET!
   JSON.stringify({ password: userInput }); // might expose sensitive data

   // ✅ DO THIS INSTEAD:
   logError('database', error); // uses redactSecrets()
   throw new Error('Database error'); // generic message
   logInfo('user', 'authentication attempt', redactObject({ ...userData }));
   ```

3. **Secrets Never Exposed in:**
   - Console logs (Deno.emit)
   - Error messages returned to client
   - Response payloads
   - Database query logging
   - API response logging

### Environment Variables Protected

Server-only (never sent to frontend):
- `SUPABASE_SERVICE_ROLE_KEY` — Bypass RLS (Edge Functions only)
- `RESEND_API_KEY` — Email provider secret
- `OPENAI_API_KEY` or `GOOGLE_GEMINI_API_KEY` — LLM secrets
- `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET` — Payment secrets
- `CRON_SECRET` — Scheduler authentication
- `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe secrets (if added)
- `TWILIO_AUTH_TOKEN` — SMS secrets (if added)

Public (sent to frontend via VITE_):
- `VITE_SUPABASE_URL` — Public project URL
- `VITE_SUPABASE_ANON_KEY` — Public anon key
- `VITE_SENTRY_DSN` — Error tracking endpoint
- `VITE_GA_ID` — Google Analytics
- `VITE_META_PIXEL_ID` — Facebook Pixel

### Verification Steps (TODO by DevOps)

Before production deployment:

- [ ] 1. **Vercel Environment Check**
  ```bash
  # Verify server-side secrets are set as environment variables (not in code)
  # - SUPABASE_SERVICE_ROLE_KEY
  # - RESEND_API_KEY
  # - OPENAI_API_KEY (or GOOGLE_GEMINI_API_KEY)
  # - CRON_SECRET
  ```

- [ ] 2. **Supabase Secrets Check**
  ```bash
  # Verify Edge Function secrets are set
  supabase secrets list
  # Should include: RESEND_API_KEY, OPENAI_API_KEY, CRON_SECRET, etc.
  ```

- [ ] 3. **Git Secrets Scan**
  ```bash
  # Ensure no secrets committed to git
  git log -S 'sk_' --all --oneline  # Supabase service role pattern
  git log -S 'Bearer ' --all --oneline  # Auth tokens
  # Should return: (no commits found)
  ```

- [ ] 4. **Build Output Check**
  ```bash
  # Verify dist/ doesn't contain secrets
  grep -r "SUPABASE_SERVICE_ROLE_KEY" dist/
  # Should return: (no matches)
  ```

- [ ] 5. **Sentry Configuration**
  ```bash
  # Set up Sentry before sending (project DSN in VITE_SENTRY_DSN)
  # Enable "Strip URLs" and "Strip Path Prefixes" to hide internal paths
  # Create Sentry Inbound Filters to block error messages containing:
  #   - "Authorization"
  #   - "api_key"
  #   - "secret"
  #   - "Bearer"
  ```

### Code Review Checklist

Every Edge Function must:

- [ ] Import from `_shared/secure-logging.ts` for logging
- [ ] Never use `console.log()` or `console.error()` directly
- [ ] Never expose `Deno.env.get()` values in responses
- [ ] Never return full error objects to client (use generic message)
- [ ] Validate all inputs (prevent injection)
- [ ] Use SECURITY DEFINER functions for sensitive RPCs
- [ ] Include `search_path = public` in RPC definitions
- [ ] REVOKE/GRANT privileges explicitly (no public access)
- [ ] Rate-limit sensitive endpoints (contact, password reset, checkout)
- [ ] Add pre-commit hook to scan for secret patterns

### Pre-Commit Hook (Prevent Secrets in Git)

Already installed via `.husky/pre-commit`:

```bash
# Blocks commit if contains patterns like:
# - sk_[a-z0-9]{20,} (Supabase)
# - SUPABASE_SERVICE_ROLE_KEY=
# - RESEND_API_KEY=
# - Bearer eyJ...
```

If not working, manually install:

```bash
npm install --save-dev detect-secrets
echo 'detect-secrets scan --baseline .secrets.baseline' > .husky/pre-commit
chmod +x .husky/pre-commit
```

### Incident Response

If a secret is exposed:

1. **Immediately revoke the secret** (Supabase UI, provider dashboard)
2. **Rotate the secret** (generate new key)
3. **Update all deployment environments** (Vercel, Supabase, CI/CD)
4. **Audit access logs** (check if secret was used maliciously)
5. **Document the incident** (for compliance)

### Ongoing Monitoring

- **Weekly:** Review Sentry error logs for exposed details
- **Monthly:** Rotate CRON_SECRET if possible
- **Per deployment:** Verify no secrets in build artifacts
- **Per PR:** ESLint rule prevents `console.log(secrets)`

---

**Status:** ✅ CODE CHANGES COMPLETE  
**Remaining:** Manual Vercel/Supabase setup by DevOps team (documented in VERIFICATION STEPS above)

