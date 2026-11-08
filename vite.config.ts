import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

/**
 * Client: nur import.meta.env.VITE_VAPID_PUBLIC_KEY (aus .env / Vercel).
 * Backend: VAPID_PUBLIC_KEY muss derselbe öffentliche Key wie VITE_VAPID_PUBLIC_KEY sein.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (process.env.VERCEL_GIT_COMMIT_REF === 'preview/vereinszentrale-modern') {
    const endpoint = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
    if (!/^https:\/\/acbaecjzoabafbsjrzvr\.supabase\.co\/?$/.test(endpoint)) {
      throw new Error('Designvergleich benötigt die bestehende TEST-Datenbank. Keine LIVE-Verbindung erlaubt.');
    }
  }

  return {
    base: "/",
    plugins: [react()],
    build: {
      /** Vite-Standard-Warnung bei großen Bundles (harmlos für Deploy) */
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
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
