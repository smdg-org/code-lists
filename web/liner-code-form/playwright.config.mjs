import { defineConfig } from "@playwright/test";

const port = process.env.PREVIEW_TEST_PORT ?? "4173";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error("PREVIEW_TEST_PORT must be a port number between 1 and 65535.");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.mjs",
  use: { baseURL, headless: true },
  webServer: {
    command: `npm run build && python3 -m http.server ${port} --bind 127.0.0.1 --directory dist`,
    url: baseURL,
    reuseExistingServer: false
  }
});
