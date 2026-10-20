import { defineConfig } from "vite";

// The Vercel showcase: a static page with the real lamp engine and no
// authentication code. All sign-in happens on the Cloudflare Worker.
export default defineConfig({
  root: "site",
  publicDir: false,
  build: {
    outDir: "../.site-dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
