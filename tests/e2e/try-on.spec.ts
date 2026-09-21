import { test, expect, type Page } from '@playwright/test'

/**
 * Virtual Try-On E2E.
 *
 * The dev server these tests run against is given a DEV-only try-on sandbox
 * (VITE_TRYON_DEV_CONFIG — see playwright.config.ts and src/lib/tryOnConfig.ts),
 * which points ONE product at a lens. That makes gating deterministic without
 * real Snap credentials: `nerve-oversized-tee` has a lens, other products don't.
 *
 * The sandbox lens ids are not credentials, so the live AR session itself can
 * only be asserted up to the point Snap's SDK is contacted (canvas + loading/
 * error state) — never that AR "works", which requires real credentials.
 */

const AR_SLUG = 'nerve-oversized-tee'
const NO_AR_SLUG = 'core-zip-hoodie'
const AR_LENS_ID = '0f1e2d3c4b5a69788796a5b4c3d2e1f0'

const TRY_ON_BUTTON = /try on .* in AR/i
/**
 * Every honest state the AR surface can be in: a loading stage, readiness
 * controls, or an error/retry overlay. Used to assert the user is never left
 * with a blank box — and never told AR is running when it isn't.
 */
const AR_STATE_TEXT =
  /initializing ar|starting camera|loading lens|preparing virtual try-on|try again|camera access|temporarily unavailable|could not reach/i
const AR_PAGE_URL = (origin: string, slug: string) => `${origin}/ar/${slug}`

/** Read a gtag-style analytics event from either a stub or a real GA dataLayer. */
function readAnalyticsEvent(page: Page, eventName: string) {
  return page.evaluate((name: string) => {
    const w = window as unknown as {
      dataLayer?: unknown[]
      __tryOnEvents?: unknown[]
    }
    const entries = [...(w.dataLayer ?? []), ...(w.__tryOnEvents ?? [])]
    const hit = entries
      .filter((entry): entry is unknown[] => Array.isArray(entry) && entry[1] === name)
      .pop()
    return hit ? (hit[2] as Record<string, unknown>) : null
  }, eventName)
}

/** Open the try-on modal from a product page. */
async function openTryOn(page: Page) {
  await page.goto(`/product/${AR_SLUG}`)
  // Guard: a 404 product page would otherwise make the gating assertions vacuous.
  await expect(page.getByTestId('add-to-bag-button')).toBeVisible()
  await page.getByRole('button', { name: TRY_ON_BUTTON }).click()
  const modal = page.getByTestId('tryon-modal')
  await expect(modal).toBeVisible()
  return modal
}

test.describe('Virtual Try-On — product page gating', () => {
  test('shows TRY ON for a product with a configured lens', async ({ page }) => {
    await page.goto(`/product/${AR_SLUG}`)
    await expect(page.getByTestId('add-to-bag-button')).toBeVisible()

    const tryOn = page.getByRole('button', { name: TRY_ON_BUTTON })
    await expect(tryOn).toBeVisible()
    await expect(tryOn).toHaveText(/try in ar/i)
  })

  test('hides TRY ON for a product without a lens', async ({ page }) => {
    await page.goto(`/product/${NO_AR_SLUG}`)
    // The product page itself is fully intact …
    await expect(page.getByTestId('add-to-bag-button')).toBeVisible()
    // … it simply has no AR entry point (no broken button, no fallback modal).
    await expect(page.getByRole('button', { name: TRY_ON_BUTTON })).toHaveCount(0)
  })
})

test.describe('Virtual Try-On — modal', () => {
  test('opens for the clicked product and loads that product’s lens', async ({ page }) => {
    const modal = await openTryOn(page)

    // Accessible dialog, titled for the product.
    await expect(modal).toHaveAttribute('aria-modal', 'true')
    await expect(modal.locator('#tryon-modal-title')).toHaveText(/try on/i)
    await expect(modal).toContainText('NERVE OVERSIZED TEE')
    await expect(modal).toContainText(/see NERVE OVERSIZED TEE in AR/i)

    // Product → lens mapping is real: this product resolved the sandbox lens
    // (rendered by the dev-only diagnostics panel), not another product's.
    await expect(modal.getByText(AR_LENS_ID)).toBeVisible()
    await expect(modal.getByRole('button', { name: /open snapchat lens/i })).toBeVisible()
  })

  test('renders a real QR code for this product', async ({ page }) => {
    const modal = await openTryOn(page)

    const qr = modal.getByTestId('tryon-qr')
    await expect(qr).toBeVisible()
    await expect(qr).toContainText(/scan to try on your phone/i)
    await expect(qr).toContainText('NERVE OVERSIZED TEE')
    // The QR is generated from the destination URL — assert it is a real SVG
    // code (modules), not a placeholder icon.
    const qrSvg = qr.locator('svg[role="img"]')
    await expect(qrSvg).toBeVisible()
    await expect(qrSvg.locator('path').first()).toBeVisible()
    // A QR is only rendered for a valid absolute URL.
    await expect(qr.getByRole('button', { name: /copy link/i })).toBeVisible()
  })

  test.describe('with clipboard access', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

    test('QR destination is this product’s own AR page', async ({ page }) => {
      const modal = await openTryOn(page)

      const copied = modal.getByRole('button', { name: /copy link/i })
      await copied.click()
      await expect(modal.getByRole('button', { name: /link copied/i })).toBeVisible()

      const clipboard = await page.evaluate(() => navigator.clipboard.readText())
      const origin = new URL(page.url()).origin
      expect(clipboard).toBe(AR_PAGE_URL(origin, AR_SLUG))
    })
  })

  test('emits try_on_opened analytics with the resolved lens', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __tryOnEvents?: unknown[]
        gtag?: (...args: unknown[]) => void
      }
      w.__tryOnEvents = []
      // Only used when GA is not configured — with a GA id the app installs its
      // own gtag, and the events land in window.dataLayer instead.
      w.gtag = (...args: unknown[]) => {
        w.__tryOnEvents?.push(args)
      }
    })

    await openTryOn(page)

    await expect
      .poll(async () => (await readAnalyticsEvent(page, 'try_on_opened'))?.lens_id)
      .toBe(AR_LENS_ID)
    const params = await readAnalyticsEvent(page, 'try_on_opened')
    expect(typeof params?.product_name).toBe('string')
    expect(params?.product_name).not.toBe('')
  })

  test('closes with the close button and restores page scroll', async ({ page }) => {
    const modal = await openTryOn(page)
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

    await modal.getByRole('button', { name: 'Close Virtual Try-On' }).click()
    await expect(page.getByTestId('tryon-modal')).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  })

  test('closes on Escape', async ({ page }) => {
    await openTryOn(page)

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('tryon-modal')).toHaveCount(0)
  })

  test('reopens cleanly with no stale dialog or AR surface', async ({ page }) => {
    const modal = await openTryOn(page)
    await modal.getByRole('button', { name: 'Close Virtual Try-On' }).click()
    await expect(page.getByTestId('tryon-modal')).toHaveCount(0)

    await page.getByRole('button', { name: TRY_ON_BUTTON }).click()
    await expect(page.getByTestId('tryon-modal')).toBeVisible()
    await expect(page.getByTestId('tryon-modal')).toHaveCount(1)
    // No leftover camera/canvas surface from a previous session.
    await expect(page.locator('canvas')).toHaveCount(0)
  })

  test('closing try-on leaves the product page usable', async ({ page }) => {
    const modal = await openTryOn(page)
    await modal.getByRole('button', { name: 'Close Virtual Try-On' }).click()

    // The AR feature must not interfere with buying the product.
    await page.getByTestId('size-option').first().click()
    await page.getByTestId('add-to-bag-button').click()
    await expect(page.getByTestId('cart-count')).toHaveText('1')
  })
})

test.describe('Virtual Try-On — AR surface', () => {
  test('starts a live AR surface (never a blank screen) and tears it down on close', async ({
    page,
  }) => {
    const modal = await openTryOn(page)

    const openAr = modal.getByRole('button', { name: /open AR experience/i })
    const qrOnly = modal.getByTestId('tryon-qr')

    if (await openAr.isVisible().catch(() => false)) {
      await openAr.click()

      // The render target appears immediately — the user never gets a blank box.
      await expect(modal.locator('canvas')).toBeVisible()
      // …followed by an honest state. With no real Snap token this stops at an
      // error rather than claiming AR is running.
      await expect(modal.getByText(AR_STATE_TEXT).first()).toBeVisible({ timeout: 20000 })
    } else {
      // Browser/device can't run in-page AR: the QR fallback must be offered.
      await expect(qrOnly).toBeVisible()
    }

    // Closing mid-initialization must clean up and leave nothing behind.
    await page
      .getByTestId('tryon-modal')
      .getByRole('button', { name: 'Close Virtual Try-On' })
      .click()
    await expect(page.getByTestId('tryon-modal')).toHaveCount(0)
    await expect(page.locator('canvas')).toHaveCount(0)
  })
})

test.describe('Virtual Try-On — /ar/:slug QR destination', () => {
  test('renders the try-on experience for the scanned product', async ({ page }) => {
    await page.goto(`/ar/${AR_SLUG}`)

    await expect(page.getByText('NERVE — Virtual Try-On')).toBeVisible()
    await expect(page.getByText(/virtual try-on/i).first()).toBeVisible()
    // The page re-resolves the lens for the product in the URL.
    await expect(page.getByText(AR_LENS_ID)).toBeVisible()
    await expect(page.getByTestId('tryon-qr')).toBeVisible()

    // Back to the product to keep shopping.
    await expect(page.getByRole('button', { name: 'Back to product', exact: true })).toBeVisible()
    await page.getByRole('link', { name: /back to NERVE OVERSIZED TEE/i }).click()
    await expect(page).toHaveURL(new RegExp(`/product/${AR_SLUG}$`))
  })

  test('never offers a broken experience for a product without a lens', async ({ page }) => {
    await page.goto(`/ar/${NO_AR_SLUG}`)

    await expect(page.getByText(/not available for this product yet/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Product', exact: true })).toBeVisible()
    // No fake QR, no CTA that cannot do anything.
    await expect(page.getByTestId('tryon-qr')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /open AR experience/i })).toHaveCount(0)
  })

  test('shows not-found for an unknown slug', async ({ page }) => {
    await page.goto('/ar/does-not-exist-at-all')

    await expect(page.getByRole('heading', { name: /product not found/i })).toBeVisible()
    await page.getByRole('link', { name: /back to nerve/i }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
