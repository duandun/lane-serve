import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart({ spa: { enabled: true } }), viteReact()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:6060',
      '/socket.io': { target: 'http://localhost:6060', ws: true },
    },
  },
})
