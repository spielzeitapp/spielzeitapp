import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

/**
 * Vite exponiert Client-Env nur als import.meta.env.VITE_*.
 * Vercel: VITE_VAPID_PUBLIC_KEY (und optional NEXT_PUBLIC_VAPID_PUBLIC_KEY) setzen;
 * Server-API: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const vapidPublic =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.VITE_VAPID_PUBLIC_KEY ??
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    env.VITE_VAPID_PUBLIC_KEY ??
    "";

  return {
    base: "/",
    define: {
      "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": JSON.stringify(vapidPublic),
    },
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
