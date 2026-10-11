import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/monthly-planner2/',
  // В дополнение к стандартному VITE_-префиксу подхватываем NEXT_PUBLIC_*
  // (на случай, если .env.local заполнен по инструкции для Next.js).
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {
      '/redmine-api': {
        target: 'https://rm.yarkiy.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/redmine-api/, ''),
      },
    },
  },
});
