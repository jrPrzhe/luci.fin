import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Plugin to bypass ngrok browser warning
const ngrokBypassPlugin = (): Plugin => {
  return {
    name: 'ngrok-bypass',
    configureServer(server) {
      // Add header early in the middleware chain
      server.middlewares.use((_req, res, next) => {
        // Add header to bypass ngrok browser warning page
        res.setHeader('ngrok-skip-browser-warning', 'true')
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), ngrokBypassPlugin()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow external connections (for ngrok)
    // Allow ngrok domains
    allowedHosts: [
      'localhost',
      '.ngrok-free.app',
      '.ngrok-free.dev', // ngrok free tier domains
      '.ngrok.app',
      '.ngrok.io',
      'galleylike-nydia-however.ngrok-free.dev', // Explicit domain
      // Allow all ngrok domains (for development)
      /^.*\.ngrok-free\.(app|dev)$/,
      /^.*\.ngrok\.(app|io)$/,
    ],
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add ngrok bypass header to proxied requests
            proxyReq.setHeader('ngrok-skip-browser-warning', 'true')
          })
        },
      },
    },
  },
})

