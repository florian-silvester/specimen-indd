import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
      external: ['indesign', 'uxp', 'os', 'fs', 'path'],
    },
  },
  // UXP doesn't support ES modules natively — inline everything
  base: './',
})
