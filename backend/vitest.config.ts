import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"], // runs before EACH test file
    // The HTTP test files all reset the SAME database. Run the files one
    // after another so one file's reset never lands in the middle of another
    // file's test. (Tests inside a file already run one at a time.)
    fileParallelism: false,
    testTimeout: 10_000,
  },
});