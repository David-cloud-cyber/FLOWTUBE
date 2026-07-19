import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // TanStack Query includes development guards behind this flag. The static
  // shell has no Node `process` global, so resolve it while bundling.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react({ jsxRuntime: 'classic' })],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/components-entry.tsx'),
      name: 'HFComponents',
      fileName: 'hf-components',
      formats: ['iife'],
    },
    outDir: 'dist-components',
    // Keep React islands self-contained. The legacy shell can retain its own
    // runtime, but the new controls remain reliable without any CDN.
    rollupOptions: { output: { inlineDynamicImports: true } },
    minify: 'esbuild',
    sourcemap: false,
  },
});
