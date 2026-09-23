# Run doc — NERVE storefront (`nerve-concept-store`)

This doc describes how a fresh worktree of this repo becomes runnable for a live
preview. It records **procedures only** — never secret values.

## 1. Reproduce the uncommitted artifacts a fresh checkout needs

1. **Install dependencies** (npm project — `package-lock.json` is committed):

   ```bash
   npm ci      # or: npm install
   ```

2. **Copy environment files from your primary checkout** (they are gitignored):
   - `.env` and `.env.local` — copy them from the checkout of this repo that
     holds the real values.
   - Use **copy, not symlink**: values such as ports/URLs may need adapting per
     worktree.
   - These are the only environment files the app reads at build/dev time.

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
- `/product/nerve-oversized-tee` — product page

### Logs

`.freebuff/preview-<thread-id>.log` (stdout) and `.log.err` (stderr).

## 3. Playwright end-to-end suite

```bash
npm run test:e2e            # whole suite
```

Playwright starts **its own dev server on port 5174** (`playwright.config.ts`),
not 5173, and always starts a fresh one (`reuseExistingServer: false`). Reason:
it must not disturb a preview server on 5173. If 5174 is occupied, stop that
process — the run fails rather than silently using a server on the wrong port.

Known pre-existing failure (fails on a clean checkout too):
`security.spec.ts › register form enforces matching passwords`.
