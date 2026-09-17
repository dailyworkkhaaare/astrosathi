import { expect, test, type Page } from "@playwright/test";

import { installAuthenticatedSession, installSupabaseMock } from "./support/mock-supabase";

test.beforeEach(async ({ context, page }, testInfo) => {
  const locale = testInfo.title.includes("localized") ? "mr" : "en";
  await installAuthenticatedSession(context, { locale, theme: "light" });
  await installSupabaseMock(page, { onboardingState: "consent_pending" });
});

test("consent starts neutral and requires only the three mandatory choices", async ({ page }) => {
  await page.goto("/onboarding/consent");

  await expect(page.getByRole("heading", { level: 1, name: "Your privacy matters" })).toBeVisible();
  await expect(page.getByText("0 of 3 required choices complete")).toBeVisible();

  const choices = page.getByRole("checkbox");
  await expect(choices).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(choices.nth(index)).not.toBeChecked();
  }

  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeDisabled();
  await choices.nth(0).check();
  await expect(page.getByText("1 of 3 required choices complete")).toBeVisible();
  await choices.nth(1).check();
  await choices.nth(2).check();

  await expect(page.getByText("3 of 3 required choices complete")).toBeVisible();
  await expect(choices.nth(3)).not.toBeChecked();
  await expect(page.getByText("Off by default", { exact: true })).toBeVisible();
  await expect(continueButton).toBeEnabled();
});

test("consent persists the existing receipt and profile contract with memory off", async ({
  page,
}) => {
  const mutations = captureConsentMutations(page);
  await page.goto("/onboarding/consent");

  const choices = page.getByRole("checkbox");
  await choices.nth(0).check();
  await choices.nth(1).check();
  await choices.nth(2).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/onboarding\/birth\/?$/);
  expect(mutations.receipts).toEqual([
    expect.objectContaining({
      consent_type: "age_eligibility",
      granted: true,
      policy_version: "2026-01",
    }),
    expect.objectContaining({ consent_type: "terms", granted: true, policy_version: "2026-01" }),
    expect.objectContaining({ consent_type: "privacy", granted: true, policy_version: "2026-01" }),
    expect.objectContaining({
      consent_type: "long_term_memory",
      granted: false,
      policy_version: "2026-01",
    }),
  ]);
  expect(mutations.profile).toEqual(
    expect.objectContaining({
      onboarding_state: "birth_pending",
      memory_enabled: false,
      locale: "en-IN",
    }),
  );
});

test("optional memory is explicit, reversible, and persists when chosen", async ({ page }) => {
  const mutations = captureConsentMutations(page);
  await page.goto("/onboarding/consent");

  const choices = page.getByRole("checkbox");
  await choices.nth(3).check();
  await expect(page.getByText("Personalization on", { exact: true })).toBeVisible();
  await choices.nth(3).uncheck();
  await expect(page.getByText("Off by default", { exact: true })).toBeVisible();
  await choices.nth(3).check();
  await choices.nth(0).check();
  await choices.nth(1).check();
  await choices.nth(2).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/onboarding\/birth\/?$/);
  expect(mutations.receipts.find((receipt) => receipt.consent_type === "long_term_memory")).toEqual(
    expect.objectContaining({ granted: true, policy_version: "2026-01" }),
  );
  expect(mutations.profile).toEqual(expect.objectContaining({ memory_enabled: true }));
});

test("legal details remain readable and reachable", async ({ page }) => {
  await page.goto("/onboarding/consent");

  const readMoreButtons = page.getByRole("button", { name: "Read more" });
  await expect(readMoreButtons).toHaveCount(2);
  await readMoreButtons.nth(0).click();
  await expect(page.getByRole("link", { name: "Read full Terms of Service" })).toHaveAttribute(
    "href",
    "/terms",
  );
  await page.getByRole("button", { name: "Read more" }).click();
  await expect(page.getByRole("link", { name: "Read full Privacy Policy" })).toHaveAttribute(
    "href",
    "/privacy",
  );

  await expectNoHorizontalOverflow(page);
});

test("localized consent copy remains readable without overflow", async ({ page }) => {
  await page.goto("/onboarding/consent");

  await expect(
    page.getByRole("heading", { level: 1, name: "तुमची गोपनीयता महत्त्वाची आहे" }),
  ).toBeVisible();
  await expect(page.getByText("3 पैकी 0 आवश्यक पर्याय पूर्ण")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

function captureConsentMutations(page: Page) {
  const mutations: {
    receipts: Array<{ consent_type?: string; granted?: boolean; policy_version?: string }>;
    profile: Record<string, unknown> | null;
  } = { receipts: [], profile: null };

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname.endsWith("/rest/v1/consent_receipts")) {
      mutations.receipts = request.postDataJSON();
    }
    if (request.method() === "PATCH" && url.pathname.endsWith("/rest/v1/profiles")) {
      mutations.profile = request.postDataJSON();
    }
  });

  return mutations;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
}
