import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /*
   * Relative base, deliberately. nearcoffee.space is a GitHub Pages site whose
   * root is already taken by the existing page, so this build has to be able
   * to sit at /room/ — or wherever it ends up — without being rebuilt for the
   * path. Safe here only because there is no client-side router; if one is
   * ever added this has to become an explicit base.
   */
  base: './',
})
