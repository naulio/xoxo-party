import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' : le même build fonctionne servi par le PC (/) ou par GitHub
// Pages dans un sous-dossier (/xoxo-party/). Le routage se fait par ancre (#/…).
// `--mode pages` produit la version GitHub Pages (dist-pages/), qui va chercher
// l'adresse du serveur dans api.json.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  build: {
    outDir: mode === 'pages' ? 'dist-pages' : 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
}))
