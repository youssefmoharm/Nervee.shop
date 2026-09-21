# Snapchat AR Try-On — Setup Guide

How to light up the **Virtual Try-On** feature in this store, end to end:
Snap developer access → Camera Kit token → clothing try-on Lens → published to a
Lens Group → pasted into the NERVE admin.

Everything in the app is already built and tested. The only work left is external
Snap configuration — no code changes required.

**Before you start**

| You need | Notes |
|---|---|
| Snap developer account | Free — <https://developers.snap.com> |
| Camera Kit access | Requires an application/approval (Step 1) |
| Lens Studio | Free desktop app — <https://ar.snap.com> |
| 3D garment meshes | One per product/colour, from CLO, Marvelous Designer, Blender, etc. |
| HTTPS deployment | Camera access requires a secure context (Vercel is fine) |

---

## Step 1 — Get Camera Kit access approved

Camera Kit is not open by default; you apply for it.

1. Sign in at <https://kit.snapchat.com/portal> with your Snapchat account.
2. Create/complete your **organization** profile (name, website, use case). Landing
   pages for Camera Kit Web access: <https://developers.snap.com/camera-kit/home>.
3. Request access to **Camera Kit Web** for your organization. Approval is manual,
   so expect a wait — you can build Lenses in Lens Studio in the meantime (Step 3).
4. Confirm you can open **My Lenses** in the Snap Kit Portal. Everything you need
   later (API token, Lens Scheduler) lives there and is tied to organization
   membership — if a teammate can't see it, their account isn't in the org yet.

> Until this is approved the storefront stays fully functional: the TRY ON button
> simply isn't shown, and no AR code is downloaded.

---

## Step 2 — Copy the Camera Kit API token

1. In the Snap Kit Portal, open **My Lenses**.
2. Find your app's **API Token** ("API Token" / "App API Token").
3. Put it in your environment as `VITE_SNAPCHAT_API_TOKEN`.

This token is designed to ship inside web bundles and is scoped to your
organization's Camera Kit app — it is **not** a secret like a Snap API key, but
still treat it as configuration: set it in your host (Vercel → Settings →
Environment Variables), not in a public repo.

***REMOVED***
# .env.local (development) — see .env.example for the documented block
VITE_SNAPCHAT_API_TOKEN=your_camera_kit_api_token
```

Vite only exposes variables prefixed with `VITE_`, and they are inlined at build
time — so **rebuild/redeploy** after changing it.

Optional store-wide fallback lens (used for any product without its own lens —
handy for a first smoke test):

***REMOVED***
VITE_SNAPCHAT_LENS_ID=your_default_lens_id
VITE_SNAPCHAT_LENS_GROUP_ID=your_default_lens_group_id
```

---

## Step 3 — Build the clothing try-on Lens in Lens Studio

Snap ships purpose-built sample projects for exactly this. Start from one instead
of building tracking from scratch.

1. Install/open Lens Studio (<https://ar.snap.com>), sign in, and on the Home page
   pick the **Clothing Try-On** sample project. Docs:
   <https://developers.snap.com/lens-studio/features/try-on/clothing-try-on>
   - Outfits use **3D Body Tracking** + **External Mesh** (Body Mesh) so garments
     deform to any body **without rigging**.
   - The template already includes an outfit carousel and hands-free UI buttons.
   - For physically simulated drape, see the **Cloth Simulation Try-On** template:
     <https://developers.snap.com/lens-studio/features/try-on/cloth-simulation-try-on>
2. Import your garment mesh (glTF/FBX) as an asset, then create the matching
   **Body Mesh** with the garment set as **External Mesh** — the template docs
   describe this pairing (`tshirt_mesh` + `tshirt_body_mesh`).
3. Replace the sample outfits: under the **3D Body Tracking** component, add a
   scene object per product/colour, add **Render Mesh Visuals** for the garment,
   and add a **Body Mesh occluder** (full or partial submeshes) so the wearer's
   body doesn't poke through the fabric.
4. Add carousel items if you want multiple colours switchable in the same Lens
   (useful: one Lens per product, colours swappable in-Lens).
5. Keep performance in mind — see Step 7 for the web-specific limits.

**Tip — one Lens per product, or one Lens for many?**
Both work, because the storefront maps *product → Lens ID* (Step 6). Per-product
Lenses give exact garment matches; a shared Lens with a carousel gives fewer
Lenses to maintain. A product with no Lens simply hides the TRY ON button.

---

## Step 4 — Publish the Lens (Lens Folder → Lens Source)

Publishing for Camera Kit is different from publishing to Snapchat.
Official reference: <https://developers.snap.com/camera-kit/ar-content/upload-lenses>

1. In Lens Studio, with the Lens project open and signed in, click **Publish Lens**.
2. The **Lens Publishing Portal** opens in your browser — choose your
   **Organization**.
3. Select (or create, with **+ Create New Lens Folder**) a **Lens Folder** to hold
   Camera Kit Lenses.
4. Choose the **visibility** setting — this matters for NERVE:

   | Visibility | Available in Camera Kit | Available in Snapchat |
   |---|---|---|
   | **Save As Draft** | ✅ | ❌ |
   | **Hidden** | ✅ | ✅ via Snapcode only |
   | **Public** | ✅ | ✅ searchable |
   | **Offline** | ✅ | ❌ |

   - **Draft** is the fastest path: it skips Snapchat QA, so the Lens is usable in
     the store immediately.
   - The storefront also has an **"Open Snapchat Lens"** button which uses Snap's
     official unlock link (`snapchat.com/unlock/?type=SNAPCODE&uuid=<lensId>`).
     That button **only works for lenses that are visible in Snapchat** — i.e.
     Hidden or Public. With a Draft Lens, in-page AR still works but that button
     leads nowhere useful, so publish as **Hidden** if you want both.
5. Click **Submit** and wait for the automated QA check.
6. **Critical:** add the Lens Folder as a **Lens Source** for your organization.
   If you skip this, the Lens will not appear in the Lens Scheduler and the
   storefront will fail with a lens-load error.

---

## Step 5 — Add the Lens to a Lens Group and copy the IDs

1. Open the **Lens Scheduler**: <https://developers.snap.com/camera-kit/ar-content/lens-scheduler>
   (also reachable as "Lens Scheduler" under **My Lenses**).
2. Add your Lens to a **Lens Group** (create one, e.g. `NERVE Try-On`).
   Camera Kit loads lenses **by Lens ID + Lens Group ID together** — both are
   required. Documents: `loadLens(lensId, lensGroupId)`.
3. Copy the **Lens ID** and the **Lens Group ID** for each try-on Lens. Both are
   32-character hex IDs.
4. **Free smoke test:** before your own Lens is ready, the Lens Scheduler includes
   a built-in sample group ("Camera Kit Sample Lenses" / "Camera Kit Mobile/Web
   Sample Lenses"). Using one of those IDs proves your token + browser setup works.

---

## Step 6 — Give the IDs to NERVE

Pick whichever fits your workflow — the storefront resolves them in this order:
**database column → static catalog → environment fallback**.

### Recommended: Admin UI (no SQL, no deploy)

1. Make sure the column exists once (migration `024_product_virtual_try_on.sql`):

   ***REMOVED***
   supabase db push
   ```

2. Sign in to the store as an admin and open **Admin → AR Try-On**
   (`/admin/try-on`).
3. For each product: tick **Enable AR**, paste the **Lens ID** and **Lens Group
   ID**, then **Save**.
   - IDs are validated (32-char hex); typos are rejected with an explanation
     rather than silently disabling AR.
   - **Clear AR** writes `null` and hides the TRY ON button for that product.
4. Done — the storefront reads `products.virtual_try_on` on the next page load.
   No rebuild needed.

### Alternative: static catalog (code)

For products backed by the static catalog in `src/data/tryOnCatalog.ts`:

```ts
export const staticTryOnOverrides: Record<string, VirtualTryOnConfig> = {
  'p-002': {
    enabled: true,
    lensId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    lensGroupId: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6',
  },
};
```

### Alternative: one Lens for everything (env fallback)

Set `VITE_SNAPCHAT_LENS_ID` + `VITE_SNAPCHAT_LENS_GROUP_ID` (Step 2). Every
product then uses that Lens — good for a pilot, not for a real catalogue range.

### While you wait: the DEV-only sandbox

You do not have to wait for Step 1 to see the feature. `VITE_TRYON_DEV_CONFIG`
points individual products at lens ids without touching the database, which is
useful for reviewing the UI, demoing it to stakeholders, and running E2E tests:

***REMOVED***
VITE_TRYON_DEV_CONFIG='{"apiToken":"<token>","lenses":{"nerve-oversized-tee":{"lensId":"<32-hex>","lensGroupId":"<32-hex>"}}}' npm run dev
```

Keys are product **slugs or ids**, listed lenses are enabled by default, and it
has the highest precedence (above the DB column) so you can override a live
value locally. Two things make it safe to keep around:

- It is read only when `import.meta.env.DEV` is true, so production builds drop
  the whole branch — a deploy still needs the real values from Steps 2–6.
- It fakes nothing: an unreachable or wrong lens still fails inside Camera Kit
  and shows the normal error states. Nothing claims AR is running.

With a sandbox lens but no real `apiToken`, the experience stops at the honest
"temporarily unavailable" state with a dev diagnostic naming the missing variable.

The Playwright suite uses the same mechanism (see `playwright.config.ts` and
`tests/e2e/try-on.spec.ts`) so try-on gating, the modal and the QR code are
tested without real credentials.

---

## Step 7 — Deploy considerations

| Topic | Requirement |
|---|---|
| HTTPS | Camera access needs a secure context. `http://` only works on `localhost`. |
| Browsers | Chrome 95+, Safari 16+, iOS/iPadOS 15+, macOS 12+. Edge is Chromium-based and Snap treats it as Chrome-like (still "under evaluation"). Firefox is "under evaluation" — we don't block it, but it isn't a supported target, so treat any Firefox result as best-effort. |
| Content-Security-Policy | If you add a CSP, allow Camera Kit: `connect-src https://*.snapar.com;` and `script-src https://cf-st.sc-cdn.net/ blob: 'wasm-unsafe-eval';`. Without these, Camera Kit fails to initialize. |
| Bundle size | No action needed — the SDK is a lazy chunk loaded only when try-on opens. |
| Performance | 3D Body Tracking is resource-intensive, especially on **Windows and mobile**; Snap's docs advise testing in a browser early (the Lens Studio preview is not representative) and using their **Push-to-Web** extension to test a Lens directly in a web app. Keep garment meshes/textures lean. |
| World tracking | 6DoF/world mesh is limited on web (falls back to ~3.5DoF). Not needed for body-anchored garments. |

---

## Step 8 — Verify it works

Storefront (`/product/<slug>`):

- [ ] Product **without** a Lens → no TRY ON button (expected, not a bug).
- [ ] Product **with** a Lens → TRY ON button appears.
- [ ] Click TRY ON → modal → **Open AR Experience** → camera permission prompt.
- [ ] Allow → the garment renders on your body and tracks as you move.
- [ ] Switch camera / close → camera indicator light goes out, reopening works.
- [ ] Deny camera → clear "Camera access was blocked" message, with a way back.
- [ ] Desktop: the modal also shows a **real QR code** for the current product.
- [ ] Scan the QR with a phone → `/ar/<slug>` opens that **same product's** Lens.

Dedicated mobile route: `/ar/<slug>` (the QR destination — standalone, product
re-resolved from the URL slug).

Development diagnostics: with `npm run dev`, the live AR view shows an
**AR Diagnostics** panel (product, Lens ID and Lens Group ID, whether the API
token is present, session state, FPS). When configuration is incomplete, the
modal also prints the exact variable to set (e.g. `VITE_SNAPCHAT_API_TOKEN`)
instead of a generic message. All of this is guarded by `import.meta.env.DEV`,
so it never ships to customers.

---

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| TRY ON button missing | No resolvable Lens config for that product | Add a Lens in **Admin → AR Try-On** (Step 6) |
| "Virtual Try-On is temporarily unavailable." | `VITE_SNAPCHAT_API_TOKEN` missing | Set the token and rebuild/redeploy (Step 2) |
| "The AR experience for this product failed to load." | Wrong Lens ID/Group ID, Lens not in the group, or Lens Folder not added as a Lens Source | Re-check both IDs in Lens Scheduler; re-publish to the Lens Source (Steps 4–5) |
| "Virtual Try-On is temporarily unavailable." in dev with a Lens ID shown | The product's config has no Lens Group ID | Add the Lens Group ID (Lens Groups are required by Camera Kit) |
| Camera never starts | Permission denied, camera busy, or non-HTTPS | Allow camera access; close other apps using it; serve over HTTPS |
| Blank/stuck loading | SDK blocked by CSP or the network | Allow `*.snapar.com` + `cf-st.sc-cdn.net` (Step 7); check the console |
| In-page AR fails on Firefox | Camera Kit Web isn't fully supported there | Use **Back** in the AR view to reach the QR / "Open Snapchat Lens" flow, or test in Chrome/Safari |
| Lens loads but runs slowly | Body tracking is heavy on web | Simplify the garment mesh, drop cloth simulation, lower texture size, cap FPS |
| "Open Snapchat Lens" does nothing useful | The Lens is visibility **Draft** (not in Snapchat) | Publish as **Hidden** to enable Snapcode unlock (Step 4) |
| Admin says "Database column missing" | Migration 024 not applied | Run `supabase db push` |

---

## Reference links

- Camera Kit home — <https://developers.snap.com/camera-kit/home>
- Web SDK setup — <https://developers.snap.com/camera-kit/integrate-sdk/web/web-configuration>
- Web performance considerations — <https://developers.snap.com/camera-kit/integrate-sdk/web/guides/web-considerations>
- Upload Lenses for Camera Kit — <https://developers.snap.com/camera-kit/ar-content/upload-lenses>
- Lens Scheduler — <https://developers.snap.com/camera-kit/ar-content/lens-scheduler>
- Clothing Try-On sample — <https://developers.snap.com/lens-studio/features/try-on/clothing-try-on>
- Cloth Simulation Try-On — <https://developers.snap.com/lens-studio/features/try-on/cloth-simulation-try-on>
- Snap Kit Portal — <https://kit.snapchat.com/portal>
