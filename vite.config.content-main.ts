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
        emptyOutDir: false,
        outDir: 'dist',
        minify: process.env.NODE_ENV === 'development' ? false : 'esbuild',
        rollupOptions: {
            input: {
                contentMain: path.resolve(__dirname, 'src/pages/ContentScript/contentMain.tsx'),
            },
            output: {
                format: 'es',
                entryFileNames: '[name].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
    esbuild: {
        drop: process.env.NODE_ENV === 'development' ? [] : ['console', 'debugger'],
    },
});
