import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// `base: '/toolkit/'` is critical: the React app is served from /toolkit/
// on the BB site, so all asset paths in the built index.html must be
// prefixed accordingly (otherwise the browser requests /assets/... at
// the site root and gets 404s, leaving the React tree unmounted).
export default defineConfig({
  base: '/toolkit/',
  plugins: [react()],
})
