import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    // Run test files sequentially in a single worker so the Express app
    // only binds to port 5001 once (avoids EADDRINUSE from parallel imports)
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
      exclude: ['src/tests/**', 'src/index.ts', 'src/config/env.ts', 'prisma/**', 'dist/**'],
    },
  },
})
