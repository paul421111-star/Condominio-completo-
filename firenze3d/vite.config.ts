import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Base relativa: o build roda tanto na raiz quanto embutido no QualiObra em /maquete/.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2500,
  },
})
