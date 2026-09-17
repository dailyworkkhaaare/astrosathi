import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/visual",
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  projects: [
    {
      name: "visual-chrome",
      use: {
        channel: "chrome",
        baseURL: "http://127.0.0.1:4173",
        colorScheme: "light",
        reducedMotion: "reduce",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        video: "off",
      },
    },
  ],
});
