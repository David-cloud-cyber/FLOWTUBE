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
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react/jsx-runtime': path.resolve(__dirname, './src/react-jsx-runtime-shim.ts'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './src/react-jsx-runtime-shim.ts'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/components-entry.tsx'),
      name: 'HFComponents',
      fileName: 'hf-components',
      formats: ['iife'],
    },
    outDir: 'dist-components',
    // Agent UI components mount into their own React roots, isolated from the
    // legacy dc-runtime shell.
    // React is loaded once by support.js. Keeping it external prevents a
    // React element from crossing into the shell's renderer from another copy.
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
      ],
      output: {
        inlineDynamicImports: true,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-dom/client': 'ReactDOM',
        },
      },
    },
    minify: 'esbuild',
    sourcemap: false,
  },
});
