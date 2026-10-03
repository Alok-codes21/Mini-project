import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const pages = ["index", "Matrix", "set", "relation", "converter", "practice", "history", "about"];

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(__dirname, `${p}.html`)])),
    },
  },
});
