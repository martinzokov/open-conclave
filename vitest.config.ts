import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // @opencode-ai/plugin/dist/index.js re-exports from "./tool" without a .js
      // extension, which Node.js ESM can't resolve. Point directly to the file.
      '@opencode-ai/plugin': path.resolve('./node_modules/@opencode-ai/plugin/dist/tool.js'),
    },
  },
});
