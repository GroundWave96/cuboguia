import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js sozinho já passa de 500 kB
    chunkSizeWarningLimit: 900,
  },
});
