import { test, expect } from "@playwright/test";

const PDF_STUB = Buffer.from("%PDF-1.0\n%%EOF");

const MOCK_PROFILE = {
  skills: ["React"],
  experience: "3 years.",
  seniority: "mid",
  roleTypes: ["Frontend Developer"],
};

async function uploadAndSearch(page: import("@playwright/test").Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "cv.pdf",
    mimeType: "application/pdf",
    buffer: PDF_STUB,
  });
  await page.getByLabel("Tel Aviv").check();
  await page.getByRole("button", { name: "Find Jobs" }).click();
}

test.describe("Error states", () => {
  test("shows server error message when CV analysis returns 500", async ({
    page,
  }) => {
    await page.route("/api/analyze-cv", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "OpenAI API error" }),
      });
    });

    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("OpenAI API error")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeEnabled();
  });

  test("shows server error message when job search returns 500", async ({
    page,
  }) => {
    await page.route("/api/analyze-cv", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROFILE),
      });
    });
    await page.route("/api/search-jobs", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Apify scraping failed" }),
      });
    });

    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("Apify scraping failed")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeEnabled();
  });

  test("shows error when CV analysis returns 401 (unauthenticated)", async ({
    page,
  }) => {
    await page.route("/api/analyze-cv", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("Unauthorized")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeEnabled();
  });

  test("shows error when CV analysis returns 429 (rate limited)", async ({
    page,
  }) => {
    await page.route("/api/analyze-cv", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Rate limit exceeded" }),
      });
    });

    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("Rate limit exceeded")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeEnabled();
  });

  test("shows generic error message on network failure", async ({ page }) => {
    await page.route("/api/analyze-cv", async (route) => {
      await route.abort("failed");
    });

    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText(/error/i)).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeEnabled();
  });
});
