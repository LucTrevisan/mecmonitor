import { defineConfig } from "vite";

// base "./" keeps asset paths relative so the build works from any subpath (e.g. GitHub Pages).
export default defineConfig({
  base: "./",
  build: { outDir: "dist", chunkSizeWarningLimit: 6000 },
  server: { host: true },
});
