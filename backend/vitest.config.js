import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.js"],
      exclude: ["src/server.js"],
    },
  },
});
