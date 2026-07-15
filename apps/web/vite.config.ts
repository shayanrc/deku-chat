import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // served from https://<user>.github.io/deku-chat/ in CI builds
  base: process.env.GITHUB_ACTIONS ? '/deku-chat/' : '/',
  plugins: [react()],
  // several @langchain packages probe process.env at module scope
  define: { 'process.env': '{}' },
  optimizeDeps: { exclude: ['@deku/ui', '@deku/core'] },
  build: { target: 'es2022' },
  server: { port: 5174 },
});
