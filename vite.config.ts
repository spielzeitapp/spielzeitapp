import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

/**
 * Vite exponiert Client-Env nur als import.meta.env.VITE_*.
 * Vercel liefert oft NEXT_PUBLIC_VAPID_PUBLIC_KEY – zur Build-Zeit einbetten,
 * damit process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY im Bundle gesetzt ist.
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
  };
});
