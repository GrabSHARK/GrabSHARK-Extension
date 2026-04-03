import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function getEmbeddedChunk(id: string) {
    const normalizedId = id.replace(/\\/g, '/');

    if (normalizedId.includes('/src/@/components/PreferencesView.tsx') ||
        normalizedId.includes('/src/@/components/Preferences/') ||
        normalizedId.includes('/src/@/components/CollectionPickerModal.tsx')) {
        return 'embedded-preferences';
    }

    if (normalizedId.includes('/src/@/components/EditLinkView.tsx') ||
        normalizedId.includes('/src/@/components/EditLink/')) {
        return 'embedded-edit';
    }

    if (normalizedId.includes('/src/@/components/AlreadySavedView.tsx') ||
        normalizedId.includes('/src/@/components/SavedLinkCard.tsx') ||
        normalizedId.includes('/src/@/components/ExtensionSettings.tsx')) {
        return 'embedded-saved';
    }

    if (normalizedId.includes('/src/@/components/SaveLinkCard.tsx') ||
        normalizedId.includes('/src/@/components/SaveLink/')) {
        return 'embedded-save';
    }

    if (normalizedId.includes('/src/@/components/Modal.tsx') ||
        normalizedId.includes('/src/@/components/OptionsForm.tsx')) {
        return 'embedded-auth';
    }

    return undefined;
}

export default defineConfig({
    base: './',
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
                embeddedUI: path.resolve(__dirname, 'src/pages/ContentScript/embeddedEntries/embeddedApp.ts'),
                captureDock: path.resolve(__dirname, 'src/pages/ContentScript/embeddedEntries/captureDock.ts'),
                saveNotificationToast: path.resolve(__dirname, 'src/pages/ContentScript/embeddedEntries/saveNotificationToast.ts'),
            },
            output: {
                format: 'es',
                entryFileNames: '[name].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') return 'embeddedUI.css';
                    return 'assets/[name]-[hash][extname]';
                },
                manualChunks(id) {
                    return getEmbeddedChunk(id);
                },
            },
        },
    },
    esbuild: {
        drop: process.env.NODE_ENV === 'development' ? [] : ['console', 'debugger'],
    },
});