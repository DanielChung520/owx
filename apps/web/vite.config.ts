import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const FRONTEND_PORT = Number(process.env.OWX_WEB_PORT ?? "13100");
const OPENCODE_URL = process.env.OWX_OPENCODE_URL ?? "http://127.0.0.1:13001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    allowedHosts: ["owx.aiconn.ai", "localhost", "127.0.0.1"],
    proxy: {
      "/session": { target: OPENCODE_URL, changeOrigin: true },
      "/global": { target: OPENCODE_URL, changeOrigin: true },
    },
  },
  preview: { port: FRONTEND_PORT },
});
