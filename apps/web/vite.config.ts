import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const FRONTEND_PORT = Number(process.env.OWX_WEB_PORT ?? "13100");
const OPENCODE_URL = process.env.OWX_OPENCODE_URL ?? "http://127.0.0.1:13001";
const HARNESS_URL = process.env.OWX_HARNESS_URL ?? "http://127.0.0.1:13110";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: FRONTEND_PORT,
    allowedHosts: ["owx.aiconn.ai", "localhost", "127.0.0.1"],
    proxy: {
      "/session": { target: OPENCODE_URL, changeOrigin: true },
      "/global": { target: OPENCODE_URL, changeOrigin: true },
      "/event": { target: OPENCODE_URL, changeOrigin: true },
      "/command": { target: OPENCODE_URL, changeOrigin: true },
      "/find": { target: OPENCODE_URL, changeOrigin: true },
      "/file": { target: OPENCODE_URL, changeOrigin: true },
      "/config": { target: OPENCODE_URL, changeOrigin: true },
      "/agent": { target: OPENCODE_URL, changeOrigin: true },
      "/provider": { target: OPENCODE_URL, changeOrigin: true },
      "/auth": { target: OPENCODE_URL, changeOrigin: true },
      "/permission": { target: OPENCODE_URL, changeOrigin: true },
      "/path": { target: OPENCODE_URL, changeOrigin: true },
      "/tui": { target: OPENCODE_URL, changeOrigin: true },
      "/api": { target: OPENCODE_URL, changeOrigin: true },
      "/rpc": { target: HARNESS_URL, changeOrigin: true },
    },
  },
  preview: { port: FRONTEND_PORT },
});
