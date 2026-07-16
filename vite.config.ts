import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Build as a library so it can be included in the existing HTML
    lib: {
      entry: path.resolve(__dirname, 'src/components-entry.tsx'),
      name: 'HFComponents',
      fileName: 'hf-components',
      formats: ['iife'], // IIFE so it runs directly in a <script> tag
    },
    outDir: 'dist-components',
    rollupOptions: {
      // React is already on window via support.js, so externalize it
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-dom/client': 'ReactDOM',
          'react/jsx-runtime': 'React',
        },
        // No code splitting — single bundle file
        inlineDynamicImports: true,
      },
    },
    // Ensure the bundle is readable during dev
    minify: false,
    sourcemap: true,
  },
});
