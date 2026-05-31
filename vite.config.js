import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/@supabase/")) return "vendor-supabase";
          if (id.includes("/lucide-react/") || id.includes("/lucide/")) return "vendor-icons";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router-dom/") ||
            id.includes("/react-router/")
          ) {
            return "vendor-react";
          }
          return "vendor";
        },
      },
    },
  },
});
