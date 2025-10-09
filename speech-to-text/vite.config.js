import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,  // Choose your preferred port (e.g., 5175 or 5173)
    strictPort: true,  // Ensures Vite fails if the port is taken
  },
});