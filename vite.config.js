import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { writeFileSync, copyFileSync } from 'fs'

// Plugin to copy index.html → 404.html for GitHub Pages SPA support
function spa404Plugin() {
  return {
    name: 'spa-404',
    closeBundle() {
      const outDir = resolve('dist')
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), spa404Plugin()],
  base: '/mealplan/',
})
