import { expect, test } from "@playwright/test";

import {
  installAuthenticatedSession,
  installClientPreferences,
  installSupabaseMock,
} from "./support/mock-supabase";

test("recovery callbacks preserve the reset-password route handoff", async ({ page }) => {
  await page.goto("/auth/callback?type=recovery");

  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("heading", { name: "Verifying your recovery link" })).toBeVisible();
});

test("authenticated callbacks preserve ready-account routing", async ({ context, page }) => {
  await installAuthenticatedSession(context);
  await installSupabaseMock(page);
  await page.goto("/auth/callback");

  await expect(page).toHaveURL(/\/home\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your chart" })).toBeVisible();
});

test("password reset preserves validation, update and completion routing", async ({
  context,
  page,
}) => {
  await installAuthenticatedSession(context);
  await installSupabaseMock(page);
  await page.goto("/reset-password");

  await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible();
  const password = page.getByLabel("New password");
  const confirmation = page.getByLabel("Confirm password");

  await password.fill("short");
  await confirmation.fill("different");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();

  await password.fill("new-password-1");
  await confirmation.fill("different-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();

  await confirmation.fill("new-password-1");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("heading", { name: "Your password is updated" })).toBeVisible();
  await expect(page).toHaveURL(/\/home\/?$/);
});

test("localized transition state remains viewport-safe", async ({ context, page }) => {
  await installClientPreferences(context, { locale: "mr", theme: "dark" });
  await page.goto("/reset-password");

  await expect(page.getByRole("heading", { name: "तुमची रिकव्हरी लिंक तपासत आहोत" })).toBeVisible();
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
});
