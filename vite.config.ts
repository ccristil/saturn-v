import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path: https://ccristil.github.io/saturn-v/
// In dev this is '/', in the Pages build it's '/saturn-v/'. All asset URLs go through
// import.meta.env.BASE_URL so they resolve correctly under the subpath.
export default defineConfig({
  base: '/saturn-v/',
  plugins: [react()],
})
