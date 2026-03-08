import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true, // ✅ wenn 5173 belegt -> Fehler statt Port-Wechsel
  },
});
