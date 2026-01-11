import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '../main.js': resolve(__dirname, 'main.ts')
    }
  },
  test: {
    include: ['test/**/*.test.js'],
    globals: false
  }
});
