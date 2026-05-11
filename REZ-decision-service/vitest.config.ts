import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engines/**/*.ts'],
      exclude: ['src/engines/**/*.test.ts']
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    onConsoleLog(log: string, type: 'stdout' | 'stderr') {
      if (type === 'stderr' && log.includes('[vite]')) {
        return false;
      }
      return true;
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
