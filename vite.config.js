import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ✅ Vite + React config for Netlify
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Netlify publish folder
  },
});
