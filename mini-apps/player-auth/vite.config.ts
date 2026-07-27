import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2018',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.module.js',
        chunkFileNames: 'assets/[name].module.js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css')
          ? 'assets/index.css'
          : 'assets/[name][extname]',
      },
    },
  },
})
