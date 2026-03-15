import { defineConfig } from 'vite'
import preact from '@preact/preset-vite' // Use preact preset

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist/ui-vite', // Output UI bundle to a subdirectory
    emptyOutDir: true, // Clear the directory before building
    rollupOptions: {
      input: 'index.html' // Specify the HTML entry point
    },
    // Optional: Minify settings if needed, often defaults are fine
    // minify: 'esbuild',
  },
  // Adjust base if necessary for Figma environment, usually root '/' is fine
  // base: '/', 
}) 