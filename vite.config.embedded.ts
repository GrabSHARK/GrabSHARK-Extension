import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite config for the Embedded UI layer.
 * 
 * This builds the heavy React UI (EmbeddedApp + all dependencies) as a
 * separate IIFE file (embeddedUI.js) that is lazy-loaded by the content
 * script only when the user opens the popup.
 * 
 * This keeps contentScript.js lightweight (~200-400KB) while deferring
 * the ~6MB React ecosystem until it's actually needed.
 */
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
        emptyOutDir: false, // Don't wipe dist (main + content builds run first)
        outDir: 'dist',
        minify: process.env.NODE_ENV === 'development' ? false : 'esbuild',
        lib: {
            entry: path.resolve(__dirname, 'src/pages/ContentScript/embeddedUI.ts'),
            name: 'SPARKEmbeddedUI',
            formats: ['es'],
            fileName: () => 'embeddedUI.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true, // Single file output, no chunk splitting
                // Don't emit CSS — embedded.css is already handled inline by EmbeddedMenuManager
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') return 'embeddedUI.css';
                    return assetInfo.name as string;
                },
            },
        },
    },
    esbuild: {
        drop: process.env.NODE_ENV === 'development' ? [] : ['console', 'debugger'],
    },
});
