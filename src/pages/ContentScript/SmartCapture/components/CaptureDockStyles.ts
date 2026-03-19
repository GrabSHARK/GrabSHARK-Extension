/**
 * CaptureDock Styles - Inline styles for Shadow DOM compatibility
 * VOID Design System
 */

export const getCaptureDockStyles = (isDark: boolean) => ({
    inner: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'stretch',
        background: isDark ? '#1e2020' : '#f2f2f0',
        border: '1px solid rgba(168, 162, 158, 0.15)',
        borderRadius: '12px',
        maxWidth: '280px',
        overflow: 'hidden',
        boxShadow: isDark
            ? 'inset 0 0.5px 0 0 rgba(255, 255, 255, 0.06), 0 2px 8px -2px rgba(0, 0, 0, 0.4)'
            : 'inset 0 0.5px 0 0 rgba(255, 255, 255, 0.8), 0 2px 8px -2px rgba(0, 0, 0, 0.08)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    headerTitle: {
        fontSize: '13px',
        fontWeight: 600,
        color: isDark ? '#e5e5e5' : '#333',
    },
    closeButton: {
        padding: '4px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: isDark ? '#888' : '#666',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        padding: '4px',
    },
    actionButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '8px 12px',
        textAlign: 'left' as const,
        fontSize: '13px',
        border: 'none',
        outline: 'none',
        borderRadius: '8px',
        background: 'transparent',
        color: isDark ? '#ccc' : '#444',
        cursor: 'pointer',
        transition: 'background 0.15s',
        boxShadow: 'none',
    },
    actionButtonHover: {
        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    actionIcon: {
        width: '16px',
        height: '16px',
        flexShrink: 0,
        opacity: 0.7,
    },
    badge: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 5px',
        background: '#3b82f6',
        color: '#fff',
        fontSize: '10px',
        fontWeight: 700,
        borderRadius: '9px',
    },
    dropdownItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: isDark ? '#bbb' : '#555',
        fontSize: '12px',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left' as const,
    },
    dropdownItemUrl: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    saveAllButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '8px 10px',
        marginTop: '4px',
        borderRadius: '8px',
        border: 'none',
        background: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
        color: '#3b82f6',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        width: '100%',
    },
});

/**
 * Truncate URL for display
 */
export function truncateUrl(url: string, maxLength = 40): string {
    try {
        const urlObj = new URL(url);
        let display = urlObj.hostname + urlObj.pathname;
        if (display.length > maxLength) {
            display = display.substring(0, maxLength - 3) + '...';
        }
        return display;
    } catch {
        if (url.length > maxLength) {
            return url.substring(0, maxLength - 3) + '...';
        }
        return url;
    }
}
