import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El navegador habla con Vite y Vite reenvia /api al backend (puerto 8080).
// Asi no hace falta CORS en Spring.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
