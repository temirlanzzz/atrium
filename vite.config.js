import { defineConfig } from 'vite';

// Relative base: the build is served from GitHub Pages (/atrium/) and from the
// portfolio at temirlan.work/atrium/ without rebuilding.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 }
});
