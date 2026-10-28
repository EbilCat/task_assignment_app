import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser only ever talks to this dev server (localhost:5173).
// Anything under /api is forwarded to Express with the prefix removed:
//   GET /api/tasks  ->  GET http://localhost:3000/tasks
// Same origin for the browser, so the backend needs no CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail loudly instead of silently moving to 5174
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});