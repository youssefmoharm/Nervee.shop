# Run doc — NERVE storefront (`nerve-concept-store`)

This doc describes how a fresh worktree of this repo becomes runnable for a live
preview. It records **procedures only** — never secret values.

## 1. Reproduce the uncommitted artifacts a fresh checkout needs

1. **Install dependencies** (npm project — `package-lock.json` is committed):

   ```bash
   npm ci      # or: npm install
   ```

   The AR try-on feature needs two deps that are in `package.json`:
   `@snap/camera-kit` (Snap Camera Kit Web SDK, lazily imported) and
   `qrcode.react` (renders the real QR code). `npm ci` installs both.

2. **Copy environment files from your primary checkout** (they are gitignored):
   - `.env` and `.env.local` — copy them from the checkout of this repo that
     holds the real values.
   - Use **copy, not symlink**: values such as ports/URLs may need adapting per
     worktree.
   - These are the only environment files the app reads at build/dev time.
   - Snap AR variables (`VITE_SNAPCHAT_API_TOKEN`, `VITE_SNAPCHAT_LENS_ID`,
     `VITE_SNAPCHAT_LENS_GROUP_ID`) are optional for a preview — see
     `.env.example`. When absent, the Try-On button is simply hidden and no AR
     code is downloaded; nothing crashes. Do not invent values for them.

3. Nothing else is generated ahead of time: the sitemap step in `npm run build`
   is only for production builds, and `npm run dev` needs no prebuild step.

## 2. How to run the server

Dev server (Vite) — default port **5173**:

```bash
npm run dev
```

If 5173 is taken, run a free port instead and use that URL when registering the
preview: `npm run dev -- --port 5180 --strictPort`.

### Starting it detached on Windows

`Start-Process` is used so the server outlives the invoking shell. Two gotchas:

- `Start-Process` cannot resolve shell shims — name the executable exactly
  (`npm.cmd`), never `npm`.
- stdout and stderr must go to **different** files.
- Redirect the wrapper's own stdio to a file (`< /dev/null > pid.txt 2>&1`).
  Without this the calling shell waits on the redirect handles still held by the
  detached child, the command appears to hang, and killing it kills the server.

```bash
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<LOG>' -RedirectStandardError '<LOG>.err' -WindowStyle Hidden -PassThru).Id" < /dev/null > .freebuff/preview-npm-pid.txt 2>&1
```

Then:

1. Read the printed pid from `.freebuff/preview-npm-pid.txt` (that is the
   `npm.cmd` wrapper).
2. Find the actual Vite process (the server pid to register) and confirm it is
   alive a few seconds later:

   ```bash
   powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'vite' } | ForEach-Object { Write-Output \$_.ProcessId }"
   curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/
   ```

3. Register the preview with the Vite node pid and the loopback URL.

### Routes worth previewing

- `/` — storefront home
- `/product/nerve-oversized-tee` — product page (TRY ON button is hidden while no
  lens is configured)
- `/ar/nerve-oversized-tee` — the standalone QR destination page; with no lens
  configured it renders the honest "Virtual Try-On is not available for this
  product yet." state

There is no real lens configured here, so **TRY ON is intentionally hidden**.
To see the try-on UI itself in the preview, start the dev server with the
DEV-only sandbox instead (one product resolves a fake, non-credential lens):

```bash
VITE_TRYON_DEV_CONFIG='{"lenses":{"nerve-oversized-tee":{"lensId":"0f1e2d3c4b5a69788796a5b4c3d2e1f0","lensGroupId":"1a2b3c4d5e6f708192a3b4c5d6e7f809"}}}' npm run dev
```

That renders the real gate + QR states (the live AR session still fails without
a real `apiToken` — it does not pretend to work).

### Logs

`.freebuff/preview-<thread-id>.log` (stdout) and `.log.err` (stderr).

## 3. Playwright end-to-end suite

```bash
npm run test:e2e            # whole suite
npx playwright test tests/e2e/try-on.spec.ts --reporter=list   # try-on only
```

Playwright starts **its own dev server on port 5174** (`playwright.config.ts`),
not 5173, and always starts a fresh one (`reuseExistingServer: false`). Two
reasons: it must not disturb a preview server on 5173, and it must control the
dev-server env below. If 5174 is occupied, stop that process — the run fails
rather than silently using a server without the env.

The web server gets one extra variable, `VITE_TRYON_DEV_CONFIG`, a DEV-only
try-on sandbox that points a single product (`nerve-oversized-tee`) at fake,
non-credential lens ids so gating/QR/modal states are deterministic. It is
ignored by production builds; see `.env.example` and `SNAPCHAT_SETUP.md`.

Known pre-existing failure (not try-on related, fails on a clean checkout too):
`security.spec.ts › register form enforces matching passwords`.
