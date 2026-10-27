import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Essential for Electron to load assets directly via file:// protocol
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  }
});
