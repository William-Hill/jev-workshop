import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    fs: { allow: [".."] },
  },
  build: {
    outDir: "bundle",
    assetsDir: "build",
    emptyOutDir: true,
    // Phaser's SVG loader base64-decodes data URIs; Vite would otherwise inline
    // the small SVG sprites as data URIs and break loading. Keep every asset as
    // a real file URL so the loader always gets a fetchable path.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: "build/[name].js",
        chunkFileNames: "build/[name].js",
        assetFileNames: "build/[name][extname]",
      },
    },
  },
});
