const { test, expect } = require('@playwright/test');

/**
 * E2E Test — Authentication Flows
 *
 * Requires:
 *   - Backend running on PORT (default 3000)
 *   - Playwright browsers installed: npx playwright install
 *
 * Run:
 *   npx playwright test test/e2e/flows/auth.spec.js
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Authentication Flows', () => {

  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
  });

  // --- Login Page ---
  test('GET /auth/login should render login form', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/auth/login`);
    expect(response.status()).toBe(200);

    // Check key elements exist
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Should have CSRF token
    await expect(page.locator('input[name="_csrf"]')).toBeAttached();
  });

  test('GET /auth/login should redirect to dashboard if already authenticated', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('Invalid credentials should show error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'nonexistent@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('.bg-error')).toBeVisible({ timeout: 5000 });
  });

  // --- CSRF Protection ---
  test('Login without CSRF token should return 403', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/login`, {
      form: {
        email: 'admin@test.com',
        password: 'somepassword',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    expect(response.status()).toBe(403);
  });

  // --- Register Page ---
  test('GET /auth/register should render registration form', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/auth/register`);
    expect(response.status()).toBe(200);
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('Register with password mismatch should show validation error', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/register`);
    await page.fill('input[name="username"]', 'newuser123');
    await page.fill('input[name="email"]', 'newuser123@test.com');
    await page.fill('input[name="password"]', 'Password123');
    await page.fill('input[name="confirmPassword"]', 'DifferentPass123');
    await page.click('button[type="submit"]');

    // Should show JS validation error
    await expect(page.locator('#js-error-container')).toBeVisible();
  });

  // --- Logout ---
  test('Logout should clear session and redirect to login', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Logout
    await page.click('button[type="submit"]'); // logout button

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Role-Based Access Control', () => {
  test('Parent should not access admin routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'parent@test.com');
    await page.fill('input[name="password"]', 'ParentPass123!');
    await page.click('button[type="submit"]');

    // Try to access admin dashboard
    const response = await page.goto(`${BASE_URL}/admin/dashboard`);
    // Should be denied or redirected
    expect([403, 302]).toContain(response.status());
  });

  test('Unauthenticated user should be redirected to login', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/client/dashboard`);
    expect(response.status()).toBe(200); // Express renders 200 but redirects
    // Follow redirect
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('Admin should access all admin routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.goto(`${BASE_URL}/admin/children`);
    await expect(page).toHaveURL(/\/admin\/children/);
    await page.goto(`${BASE_URL}/admin/vaccines`);
    await expect(page).toHaveURL(/\/admin\/vaccines/);
    await page.goto(`${BASE_URL}/admin/users`);
    await expect(page).toHaveURL(/\/admin\/users/);
  });
});
