import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    base: "/leetcode-streaks/",
    server: {
        proxy: {
            "/api": {
                target: "https://leetcode-streaks-dyg6.onrender.com",
                changeOrigin: true,
            },
        },
    },
});
