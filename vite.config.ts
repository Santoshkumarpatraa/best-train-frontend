import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/stations': {
        target: 'https://best-train-backend.onrender.com',
        changeOrigin: true,
      },
      '/health': {
        target: 'https://best-train-backend.onrender.com',
        changeOrigin: true,
      },
      '/train': {
        target: 'https://best-train-backend.onrender.com',
        changeOrigin: true,
      },
      '/station': {
        target: 'https://best-train-backend.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
