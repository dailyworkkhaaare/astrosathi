import { expect, test } from "@playwright/test";

import { installClientPreferences, installSupabaseMock } from "./support/mock-supabase";

test("sign-in and sign-up retain their validation contract", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email is required.", { exact: true })).toBeVisible();
  await expect(page.getByText("Password is required.", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Create your account" })).toBeVisible();
  await page.getByLabel("Full name").fill("Aarohi Test");
  await page.getByLabel("Email").fill("aarohi@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("valid-pass-1");
  await page.getByLabel("Confirm password").fill("different-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Passwords do not match.", { exact: true })).toBeVisible();
});

test("password recovery preserves the Supabase recovery handoff", async ({ page }) => {
  await installSupabaseMock(page);
  await page.goto("/auth");

  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill("aarohi@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Check your inbox", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to sign in" })).toBeVisible();
});

test("successful email sign-in retains the ready-account route", async ({ page }) => {
  await installSupabaseMock(page);
  await page.goto("/auth");

  await page.getByLabel("Email").fill("journey@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-pass");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/home\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your chart" })).toBeVisible();
});

test("localized auth screen remains viewport-safe", async ({ context, page }) => {
  await installClientPreferences(context, { locale: "hi", theme: "dark" });
  await page.goto("/auth");

  await expect(page.getByRole("heading", { level: 1, name: "वापसी पर स्वागत है" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "अपनी ज्योतिषीय बातचीत में लौटें।" }),
  ).toBeVisible();
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
});
