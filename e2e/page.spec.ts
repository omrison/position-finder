import { test, expect } from "@playwright/test";

const PDF_STUB = Buffer.from("%PDF-1.0\n%%EOF");

test.describe("Home page — structure and form validation", () => {
  test("renders heading, upload zone, filters, and disabled button", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Position Finder" })
    ).toBeVisible();
    await expect(page.getByText("Upload CV (PDF or DOCX)")).toBeVisible();
    await expect(page.getByText("Regions")).toBeVisible();
    await expect(page.getByText("Timeframe")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeDisabled();
  });

  test("shows all 11 region checkboxes", async ({ page }) => {
    await page.goto("/");
    const regions = [
      "Tel Aviv",
      "Jerusalem",
      "Haifa",
      "Beer Sheva",
      "Ramat Gan",
      "Petah Tikva",
      "Rishon LeZion",
      "Herzliya",
      "Netanya",
      "Eilat",
      "Remote",
    ];
    for (const region of regions) {
      await expect(page.getByLabel(region)).toBeVisible();
    }
  });

  test("24h timeframe is selected by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Last 24 hours")).toBeChecked();
    await expect(page.getByLabel("Last 48 hours")).not.toBeChecked();
    await expect(page.getByLabel("Last week")).not.toBeChecked();
  });

  test("Find Jobs disabled with only CV, enabled after adding a region", async ({
    page,
  }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Find Jobs" });

    await page.locator('input[type="file"]').setInputFiles({
      name: "cv.pdf",
      mimeType: "application/pdf",
      buffer: PDF_STUB,
    });
    await expect(button).toBeDisabled();

    await page.getByLabel("Tel Aviv").check();
    await expect(button).toBeEnabled();
  });

  test("Find Jobs disabled with only a region, enabled after adding CV", async ({
    page,
  }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Find Jobs" });

    await page.getByLabel("Haifa").check();
    await expect(button).toBeDisabled();

    await page.locator('input[type="file"]').setInputFiles({
      name: "cv.pdf",
      mimeType: "application/pdf",
      buffer: PDF_STUB,
    });
    await expect(button).toBeEnabled();
  });

  test("uploading an invalid file type shows an error and keeps button disabled", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "cv.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("plain text content"),
    });
    await expect(
      page.getByText("Only PDF and DOCX files are supported.")
    ).toBeVisible();
    await page.getByLabel("Tel Aviv").check();
    await expect(
      page.getByRole("button", { name: "Find Jobs" })
    ).toBeDisabled();
  });

  test("uploaded CV filename is shown on the upload zone", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "my-resume.pdf",
      mimeType: "application/pdf",
      buffer: PDF_STUB,
    });
    await expect(page.getByText("my-resume.pdf")).toBeVisible();
  });

  test("can toggle timeframe between options", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Last 48 hours").check();
    await expect(page.getByLabel("Last 48 hours")).toBeChecked();
    await expect(page.getByLabel("Last 24 hours")).not.toBeChecked();

    await page.getByLabel("Last week").check();
    await expect(page.getByLabel("Last week")).toBeChecked();
  });

  test("can toggle region checkboxes on and off", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Tel Aviv").check();
    await expect(page.getByLabel("Tel Aviv")).toBeChecked();

    await page.getByLabel("Tel Aviv").uncheck();
    await expect(page.getByLabel("Tel Aviv")).not.toBeChecked();
  });
});
