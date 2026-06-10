import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const here = import.meta.dirname;

export default defineConfig({
    root: here,
    base: "/",
    plugins: [
        svelte({
            onwarn(warning, defaultHandler) {
                const code = warning.code || "";
                if (code.startsWith("a11y") || code === "state_referenced_locally") return;
                defaultHandler(warning);
            },
        }),
        tailwindcss(),
    ],
    build: {
        outDir: path.resolve(here, "..", "public"),
        emptyOutDir: false,
        assetsDir: "assets",
        rollupOptions: {
            input: path.resolve(here, "index.html"),
        },
    },
    server: {
        port: 5173,
        proxy: {
            "/api": "http://localhost:3000",
        },
    },
});
