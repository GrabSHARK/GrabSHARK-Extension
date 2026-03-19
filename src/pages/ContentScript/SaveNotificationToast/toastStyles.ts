/**
 * Toast Styles - Inline styles for Shadow DOM compatibility
 * Matches SavedLinkCard.tsx color values exactly 
 */

import { useState, useEffect } from 'react';

export const getToastStyles = (isDark: boolean) => ({
    card: {
        backgroundColor: isDark ? '#0c0c0e' : '#e8e8eb',
        borderRadius: '16px',
        overflow: 'hidden' as const,
        border: isDark ? '1px solid rgba(39, 39, 42, 0.5)' : '1px solid #e4e4e7',
        boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        transition: 'all 0.3s ease',
    },
    cardContent: {
        padding: '16px',
        display: 'flex',
        gap: '12px',
    },
    thumbnail: {
        flexShrink: 0,
        width: '64px',
        height: '64px',
        backgroundColor: isDark ? '#27272a' : '#e4e4e7',
        borderRadius: '12px',
        overflow: 'hidden' as const,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isDark ? '1px solid rgba(63, 63, 70, 0.5)' : '1px solid #e4e4e7',
        position: 'relative' as const,
    },
    title: {
        fontSize: '14px',
        fontWeight: 600,
        color: isDark ? '#f4f4f5' : '#18181b',
        overflow: 'hidden' as const,
        textOverflow: 'ellipsis' as const,
        whiteSpace: 'nowrap' as const,
        paddingRight: '8px',
        margin: 0,
        lineHeight: 1.4,
    },
    meta: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: isDark ? '#a1a1aa' : '#71717a',
        marginTop: '4px',
    },
    divider: {
        height: '1px',
        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#d4d4d8',
        width: '100%',
    },
    actions: {
        display: 'flex',
    },
    actionBtn: {
        flex: 1,
        padding: '12px 8px',
        fontSize: '12px',
        fontWeight: 600,
        color: isDark ? '#f4f4f5' : '#18181b',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
    },
    actionBtnHover: {
        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '0 4px',
    },
    headerText: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        color: isDark ? '#f4f4f5' : '#18181b',
        fontWeight: 500,
    },
    checkBadge: {
        backgroundColor: '#2563eb',
        borderRadius: '50%',
        padding: '6px',
        boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        padding: '6px',
        borderRadius: '50%',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        color: '#71717a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnHover: {
        backgroundColor: isDark ? '#27272a' : '#e4e4e7',
    },
    tail: {
        height: '24px',
        backgroundColor: isDark ? '#0c0c0e' : '#e8e8eb',
        borderBottomLeftRadius: '12px',
        borderBottomRightRadius: '12px',
        borderLeft: isDark ? '1px solid rgba(39, 39, 42, 0.5)' : '1px solid #e4e4e7',
        borderRight: isDark ? '1px solid rgba(39, 39, 42, 0.5)' : '1px solid #e4e4e7',
        borderBottom: isDark ? '1px solid rgba(39, 39, 42, 0.5)' : '1px solid #e4e4e7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        color: isDark ? '#3f3f46' : '#d4d4d8',
    },
});

/** Detect dark mode hook */
export const useIsDark = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const check = () => {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const htmlDark = document.documentElement.classList.contains('dark');
            setIsDark(prefersDark || htmlDark);
        };
        check();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', check);
        return () => mediaQuery.removeEventListener('change', check);
    }, []);

    return isDark;
};
