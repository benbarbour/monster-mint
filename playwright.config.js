const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true
  },
  webServer: {
    command: "python3 -m http.server 4173 --directory dist --bind 127.0.0.1",
    port: 4173,
    reuseExistingServer: true,
    timeout: 10_000
  }
});

