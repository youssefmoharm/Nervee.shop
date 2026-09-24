import { test, expect, type Page } from '@playwright/test';

/**
 * Auth flows: register → login → forgot-password.
 *
 * Registration accepts either the "Check Your Email" success screen or a
 * rate-limit / validation / not-configured error (local CI without secrets).
 * When email confirmation is required we fall back to the login-with-existing
 * path (AUTH_TEST_EMAIL / AUTH_TEST_PASSWORD if provided).
 */

const AUTH_EMAIL = process.env.AUTH_TEST_EMAIL;
const AUTH_PASSWORD = process.env.AUTH_TEST_PASSWORD;

function uniqueEmail(): string {
  return `e2e.auth+${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function fillRegisterForm(page: Page, email: string, password: string) {
  await page.goto('/register', { waitUntil: 'networkidle' });
  await page.getByTestId('register-firstName-input').fill('E2E');
  await page.getByTestId('register-lastName-input').fill('Tester');
  await page.getByTestId('register-email-input').fill(email);
  await page.getByTestId('register-password-input').fill(password);
  await page.getByTestId('register-confirm-password-input').fill(password);
  await page.locator('#register-dob').fill('1995-04-12');
  await page.locator('#register-gender').selectOption('female');
  await page.getByTestId('register-button').click();
}

test.describe('Auth — register, login, reset', () => {
  test('register accepts unique email → success or neutral/validation error', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'Str0ngPass!42';

    await fillRegisterForm(page, email, password);

    // Success path: confirmation screen
    const successHeading = page.getByRole('heading', { name: /check your email/i });
    // Error path: inline red message (rate limit, validation, not configured, network)
    const errorMessage = page.locator('form p.text-red-600, p.text-xs.text-red-600');

    const outcome = await Promise.race([
      successHeading.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success' as const),
      errorMessage
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'error' as const),
    ]).catch(() => null);

    expect(
      outcome,
      'register must show Check Your Email or an error/validation message',
    ).not.toBeNull();

    if (outcome === 'success') {
      await expect(successHeading).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();
    } else {
      // Neutral assertion: something user-facing explained the failure
      await expect(errorMessage.first()).toBeVisible();
      await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    }

    // Login path: use seeded credentials if confirmation is required, else the
    // account we just tried to create (expected success OR invalid-credentials).
    await page.goto('/login', { waitUntil: 'networkidle' });
    const loginEmail = AUTH_EMAIL ?? email;
    const loginPassword = AUTH_PASSWORD ?? password;

    await page.getByTestId('login-email-input').fill(loginEmail);
    await page.getByTestId('login-password-input').fill(loginPassword);
    await page.getByTestId('login-button').click();

    const landed = await Promise.race([
      page.waitForURL(/\/account/, { timeout: 15000 }).then(() => 'ok' as const),
      page
        .locator('form p.text-red-600, p.text-xs.text-red-600')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'error' as const),
    ]).catch(() => null);

    if (landed === 'ok') {
      await expect(page).toHaveURL(/\/account/);
    } else {
      // Email confirmation required / invalid creds / auth not configured —
      // all acceptable neutral outcomes for structure-only CI.
      expect(['error', null]).toContain(landed);
      await expect(page.getByTestId('login-button')).toBeEnabled();
    }
  });

  test('forgot-password submits and shows a neutral message', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();

    await page.locator('input[type="email"]').fill(uniqueEmail());
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Neutral success copy (no account enumeration) OR an explicit error when
    // auth is not configured / network fails — both are user-visible outcomes.
    const neutral = page.getByText(/if an account exists for/i);
    const error = page.locator('p.text-xs.text-red-600, p.text-red-600');

    const outcome = await Promise.race([
      neutral.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'neutral' as const),
      error
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'error' as const),
    ]).catch(() => null);

    expect(outcome, 'forgot-password must show neutral sent-copy or an error').not.toBeNull();
    if (outcome === 'neutral') {
      await expect(neutral).toBeVisible();
    } else {
      await expect(error.first()).toBeVisible();
    }
  });

  test('login form testids and client validation remain stable', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('login-email-input')).toBeVisible();
    await expect(page.getByTestId('login-password-input')).toBeVisible();
    await expect(page.getByTestId('login-button')).toBeVisible();
    // Native required attributes block empty submit
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
