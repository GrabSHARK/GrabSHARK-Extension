import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    build: {
        emptyOutDir: false, // Don't wipe the dist folder (main build runs first)
        outDir: 'dist',
        lib: {
            entry: path.resolve(__dirname, 'src/pages/ContentScript/contentScript.tsx'),
            name: 'SPARKContentScript',
            formats: ['iife'], // Force IIFE to bundle everything into one file without imports
            fileName: () => 'contentScript.js',
        },
        rollupOptions: {
            output: {
                extend: true,
                globals: {
                    chrome: 'chrome',
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') return 'contentScript.css';
                    return assetInfo.name as string;
                },
            },
        },
    },
});
