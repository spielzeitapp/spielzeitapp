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
        output: {
          // Tesseract appends eng.traineddata.gz to the language directory URL.
          assetFileNames: (asset) => asset.names.includes('eng.traineddata.gz')
            ? 'assets/tournament-link-ocr-v1/eng.traineddata.gz'
            : 'assets/[name]-[hash][extname]',
        },
        input: {
          main: resolve(__dirname, "index.html"),
          marketManager: resolve(__dirname, "vereinsmarkt-manager.html"),
          tournamentAudience: resolve(__dirname, "turniere.html"),
          market: resolve(__dirname, "markt.html"),
          comparison: resolve(__dirname, "vereinszentrale.html"),
          preview: resolve(__dirname, "preview.html"),
          app: resolve(__dirname, "app.html"),
          demo: resolve(__dirname, "demo.html"),
          manager: resolve(__dirname, "manager.html"),
          usc: resolve(__dirname, "usc.html"),
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
      allowedHosts: ["terminal.local"], // Managed development preview only.
      host: true,
      port: 5173,
      strictPort: true, // ✅ wenn 5173 belegt -> Fehler statt Port-Wechsel
    },
  };
});
