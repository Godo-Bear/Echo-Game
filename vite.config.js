import { defineConfig } from 'vite';

// Relative paths, so the built game works from any folder or sub-URL.
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
});
