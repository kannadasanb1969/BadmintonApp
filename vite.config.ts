import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const { STAGING_JAVA_ORIGIN, STAGING_WEB_API_ORIGIN, RENDER_EXTERNAL_HOSTNAME } = loadEnv(mode, '.', '')
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    // The hosted staging frontend keeps requests same-origin. Local Vite and
    // production builds keep their existing API configuration.
    preview: {
      allowedHosts: RENDER_EXTERNAL_HOSTNAME ? [RENDER_EXTERNAL_HOSTNAME] : undefined,
      proxy: STAGING_JAVA_ORIGIN && STAGING_WEB_API_ORIGIN ? {
        '/api/web/': { target: STAGING_WEB_API_ORIGIN, changeOrigin: true },
        '^/api/(?!web(?:/|$)|dev(?:/|$)|internal(?:/|$))': {
          target: STAGING_JAVA_ORIGIN,
          changeOrigin: true,
          ws: true,
        },
      } : undefined,
    },
  }
})
