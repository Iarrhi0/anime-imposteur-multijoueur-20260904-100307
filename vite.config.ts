import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' so the build works on GitHub Pages under /<repo>/ and inside the Android WebView.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 }
});
