import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

/**
 * Client: nur import.meta.env.VITE_VAPID_PUBLIC_KEY (aus .env / Vercel).
 * Backend: VAPID_PUBLIC_KEY muss derselbe öffentliche Key wie VITE_VAPID_PUBLIC_KEY sein.
 */
export default defineConfig(({ mode }) => {
  loadEnv(mode, process.cwd(), "");

  return {
    base: "/",
    plugins: [react()],
    build: {
      /** Vite-Standard-Warnung bei großen Bundles (harmlos für Deploy) */
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          app: resolve(__dirname, "app.html"),
        },
        onwarn(warning, defaultHandler) {
          if (
            warning.code === "EMPTY_CHUNK" ||
            warning.code === "MODULE_LEVEL_DIRECTIVE" ||
            (typeof warning.message === "string" &&
              (warning.message.includes("chunk") ||
                warning.message.includes("Chunk")))
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true, // ✅ wenn 5173 belegt -> Fehler statt Port-Wechsel
    },
  };
});
