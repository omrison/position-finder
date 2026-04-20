import { test, expect } from "@playwright/test";

const PDF_STUB = Buffer.from("%PDF-1.0\n%%EOF");

const MOCK_PROFILE = {
  skills: ["TypeScript", "React", "Node.js"],
  experience: "5 years of full-stack development in fintech.",
  seniority: "senior",
  roleTypes: ["Software Engineer", "Full Stack Developer"],
};

const MOCK_JOBS = [
  {
    role: "Senior Software Engineer",
    company: "TechCorp",
    postedAt: new Date().toISOString(),
    source: "Indeed IL",
    url: "https://example.com/job/1",
    score: 9,
  },
  {
    role: "Full Stack Developer",
    company: "StartupXYZ",
    postedAt: new Date().toISOString(),
    source: "Indeed IL",
    url: "https://example.com/job/2",
    score: 7,
  },
];

const MOCK_STATS = {
  scraped: 50,
  duplicatesRemoved: 5,
  outsideRegions: 3,
  scored: 42,
  belowThreshold: 35,
  capped: 0,
  shown: 2,
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

test.describe("Job search — happy path", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("/api/analyze-cv", async (route) => {
      await new Promise((r) => setTimeout(r, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROFILE),
      });
    });

    await page.route("/api/search-jobs", async (route) => {
      await new Promise((r) => setTimeout(r, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: MOCK_JOBS, stats: MOCK_STATS }),
      });
    });
  });

  test("shows 'Analyzing your CV…' while waiting for CV analysis", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndSearch(page);
    await expect(page.getByText("Analyzing your CV…")).toBeVisible();
  });

  test("shows 'Searching and scoring jobs' after CV analysis completes", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndSearch(page);
    await expect(
      page.getByText("Searching and scoring jobs")
    ).toBeVisible({ timeout: 5000 });
  });

  test("displays results table with correct job rows", async ({ page }) => {
    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("Senior Software Engineer")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("TechCorp")).toBeVisible();
    await expect(page.getByText("Full Stack Developer")).toBeVisible();
    await expect(page.getByText("StartupXYZ")).toBeVisible();
  });

  test("shows correct match score badges", async ({ page }) => {
    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("9/10")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("7/10")).toBeVisible();
  });

  test("shows Apply links for each job", async ({ page }) => {
    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("Senior Software Engineer")).toBeVisible({
      timeout: 10000,
    });
    const applyLinks = page.getByRole("link", { name: "Apply →" });
    await expect(applyLinks).toHaveCount(2);
  });

  test("shows stats bar with scraped count after search", async ({ page }) => {
    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("Scraped")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("50")).toBeVisible();
  });

  test("Find Jobs button re-enables after search completes", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndSearch(page);

    await expect(page.getByText("Senior Software Engineer")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeEnabled();
  });

  test("shows empty state message when no jobs match", async ({ page }) => {
    await page.unroute("/api/search-jobs");
    await page.route("/api/search-jobs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobs: [],
          stats: { ...MOCK_STATS, shown: 0, belowThreshold: 42 },
        }),
      });
    });

    await page.goto("/");
    await uploadAndSearch(page);

    await expect(
      page.getByText("No matching jobs found.")
    ).toBeVisible({ timeout: 10000 });
  });
});
