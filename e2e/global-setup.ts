import { encode } from "@auth/core/jwt";
import { chromium } from "@playwright/test";
import fs from "fs";

function loadEnvLocal(): void {
  try {
    const content = fs.readFileSync(".env.local", "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z_]+)\s*=\s*([^#\n]*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // .env.local not present — fall back to process.env
  }
}

export default async function globalSetup() {
  loadEnvLocal();

  const secret = process.env.AUTH_SECRET ?? "test-auth-secret-for-e2e-only";

  const token = await encode({
    token: {
      name: "Test User",
      email: "test@example.com",
      sub: "test-user-id",
    },
    secret,
    salt: "authjs.session-token",
    maxAge: 60 * 60 * 24,
  });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const storageState = await context.storageState();
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/auth.json", JSON.stringify(storageState));

  await browser.close();
}
