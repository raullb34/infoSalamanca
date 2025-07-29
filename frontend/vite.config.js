import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frontendHost = env.FRONTEND_HOST || 'localhost'
  const frontendPort = env.FRONTEND_PORT ? parseInt(env.FRONTEND_PORT) : 3000
  const backendHost = env.BACKEND_HOST || 'localhost'
  const backendPort = env.BACKEND_PORT || 4000
  return {
    plugins: [vue()],
    server: {
      port: frontendPort,
      host: frontendHost,
      proxy: {
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      outDir: 'dist'
    },
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
})
