import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
    root: path.resolve('./frontend'),
    plugins: [svelte()],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000'
        }
    },
    build: {
        outDir: path.resolve('./public'),
        emptyOutDir: true
    }
});
