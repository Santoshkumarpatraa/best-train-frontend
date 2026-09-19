import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Paths owned by the API. The app calls these relatively, so in dev the server
// below forwards them; in production the app and API sit behind one origin.
const API_PATHS = ['/station', '/stations', '/train', '/place', '/health']
const API_TARGET = 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      API_PATHS.map((path) => [path, { target: API_TARGET, changeOrigin: true }]),
    ),
  },
})
