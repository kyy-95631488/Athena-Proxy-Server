import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/admin': 'http://localhost:8787',
      '/download': 'http://localhost:8787',
      '/?mode=': 'http://localhost:8787'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
