import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: "./", // ✅ ensures correct paths in Netlify/Vercel build
  server: {
    port: 5176,        // your preferred dev port
    strictPort: true,  // fails if port is already in use
  },
  build: {
    outDir: "dist",    // ✅ Netlify will publish this folder
  },
});
