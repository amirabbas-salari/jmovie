import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// در توسعه، درخواست‌های API از طریق پروکسی وایت به بک‌اند لوکال می‌روند
// تا نیازی به ست‌کردن VITE_API_BASE_URL و درگیرشدن با CORS نباشد.
// در production مقدار VITE_API_BASE_URL از محیط خوانده می‌شود.
const API_PROXY = Object.fromEntries(
  ["/admin", "/accounts", "/movies", "/series", "/genres", "/comments",
   "/people", "/collections", "/search", "/ai", "/api", "/media"]
    .map((path) => [path, { target: "http://localhost:8000", changeOrigin: true }])
);

export default defineConfig({
  plugins: [react(), svgr()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [".e2b.app"],
    proxy: API_PROXY,
  },
});
