import { test, expect } from "@playwright/test";

// Runs in the unauthenticated project — no session cookie set
test.describe("Unauthenticated access", () => {
  test("redirects / to /login when not signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page shows app heading", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Position Finder" })
    ).toBeVisible();
  });

  test("login page shows sign-in tagline", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByText("Sign in to find your next job in Israel")
    ).toBeVisible();
  });

  test("login page shows Sign in with Google button", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("navigating directly to /login stays on /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });
});

// Overrides the project default to use the authenticated session
test.describe("Authenticated state", () => {
  test.use({ storageState: "test-results/auth.json" });

  test("authenticated user lands on home page, not /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Position Finder" })
    ).toBeVisible();
  });

  test("shows user email in the header when signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("test@example.com")).toBeVisible();
  });

  test("shows Sign out button when signed in", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Sign out" })
    ).toBeVisible();
  });
});
