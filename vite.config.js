import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Deploying to GitHub Pages at https://shammahpaul.github.io/content-studio/
  base: '/content-studio/',
});
