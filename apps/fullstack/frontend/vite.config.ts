import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['@deku/ui', '@deku/core'] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5175',
    },
  },
});
