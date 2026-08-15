import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Overridable so a test can stand up its own API instance on another
        // port and point a second dev server at it.
        target: process.env.API_PROXY_TARGET ?? "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    // Keep initial JS small; React.lazy() chunks below load on demand.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          // Big visualization libs in their own chunk so they're cached
          // independently of app code.
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          recharts: ["recharts"],
          pdf: ["pdfmake/build/pdfmake.js", "pdfmake/build/vfs_fonts.js"],
          xlsx: ["xlsx", "file-saver"],
        },
      },
    },
  },
});
