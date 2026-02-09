/**
 * CaptureDock - React component for CaptureActionBar UI
 * Uses inline styles for Shadow DOM compatibility (Tailwind doesn't work in Shadow DOM)
 */

import React, { useState } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { CaptureActionType, CaptureTarget, getFileTypeLabel, SmartCaptureCallbacks } from '../types';
import { ContentExtractor } from '../../shared/ContentExtractor';
import i18n from '../../../../@/lib/i18n';

/** Action definitions with Bootstrap Icons */
const ACTION_ICONS: Record<CaptureActionType, React.ReactNode> = {
    save_link: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" />
            <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" />
        </svg>
    ),
    save_image: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M6.502 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
            <path d="M14 14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zM4 1a1 1 0 0 0-1 1v10l2.224-2.224a.5.5 0 0 1 .61-.075L8 11l2.157-3.02a.5.5 0 0 1 .76-.063L13 10V4.5h-2A1.5 1.5 0 0 1 9.5 3V1z" />
        </svg>
    ),
    save_video: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M6 6.883v4.234a.5.5 0 0 0 .757.429l3.528-2.117a.5.5 0 0 0 0-.858L6.757 6.454a.5.5 0 0 0-.757.43z" />
            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z" />
        </svg>
    ),
    save_file: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293z" />
            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z" />
        </svg>
    ),
    highlight: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M11.096.644a2 2 0 0 1 2.791.036l1.433 1.433a2 2 0 0 1 .035 2.791l-.413.435-8.07 8.995a.5.5 0 0 1-.372.166h-3a.5.5 0 0 1-.234-.058l-.412.412A.5.5 0 0 1 2.5 15h-2a.5.5 0 0 1-.354-.854l1.412-1.412A.5.5 0 0 1 1.5 12.5v-3a.5.5 0 0 1 .166-.372l8.995-8.07zm-.115 1.47L2.727 9.52l3.753 3.753 7.406-8.254zm3.585 2.17.064-.068a1 1 0 0 0-.017-1.396L13.18 1.387a1 1 0 0 0-1.396-.018l-.068.065zM5.293 13.5 2.5 10.707v1.586L3.707 13.5z" />
        </svg>
    ),
    clip: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M3.5.5A.5.5 0 0 1 4 1v13h13a.5.5 0 0 1 0 1h-2v2a.5.5 0 0 1-1 0v-2H3.5a.5.5 0 0 1-.5-.5V4H1a.5.5 0 0 1 0-1h2V1a.5.5 0 0 1 .5-.5m2.5 3a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4H6.5a.5.5 0 0 1-.5-.5" />
        </svg>
    ),
    add_note: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z" />
            <path d="M5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
        </svg>
    ),
};

const SPINNER_ICON = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16" height="16" fill="currentColor"
        viewBox="0 0 16 16"
        style={{ animation: 'ext-lw-spin 1s linear infinite' }}
    >
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0A6.5 6.5 0 0 0 1.5 8z" opacity="0.2" />
        <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5h1.5A8 8 0 0 0 8 0z" />
    </svg>
);

const CHECK_ICON = (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#10b981" viewBox="0 0 16 16">
        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.42-6.446a.5.5 0 0 1 .012-.012z" />
    </svg>
);

const ACTION_LABELS: Record<CaptureActionType, string> = {
    save_link: 'smartActions.saveLink',
    save_image: 'smartActions.saveImage',
    save_video: 'smartActions.saveVideo',
    save_file: 'smartActions.saveFile',
    highlight: 'smartActions.highlight',
    clip: 'smartActions.clip',
    add_note: 'smartActions.addNote',
};

interface CaptureDockProps {
    target: CaptureTarget;
    isDark: boolean;
    callbacks: SmartCaptureCallbacks;
    faviconUrl: string;
}

interface ActionItem {
    url: string;
    label: string;
}

// Inline styles for Shadow DOM compatibility - VOID Design System
const getStyles = (isDark: boolean) => ({
    // Inner container - content area (matches VOID / AlreadySaved style)
    inner: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'stretch',
        background: isDark ? '#1e2020' : '#f2f2f0',
        border: '1px solid rgba(168, 162, 158, 0.15)',
        borderRadius: '12px',
        maxWidth: '280px', // Prevent excessive width
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
    dropdownContentContainer: {
        zIndex: 2147483647,
        paddingLeft: '12px', // Create hit area bridge (8px gap + 4px overlap)
        marginLeft: '-4px', // Shift back to overlap the trigger slightly
        filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.2))',
    },
    dropdownContent: {
        width: 'max-content',
        minWidth: '160px',
        maxHeight: '280px',
        overflow: 'auto',
        background: isDark ? '#1e1e1e' : '#f5f5f5',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: '12px',
        padding: '6px',
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
function truncateUrl(url: string, maxLength = 40): string {
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

/**
 * Single action button (no dropdown)
 */
function ActionButton({
    label,
    icon,
    onClick,
    isDark,
}: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    isDark: boolean;
}) {
    const styles = getStyles(isDark);
    const [hovered, setHovered] = useState(false);

    return (
        <button
            style={{
                ...styles.actionButton,
                ...(hovered ? styles.actionButtonHover : {}),
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
            title={label}
        >
            <span style={styles.actionIcon}>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
        </button>
    );
}

/**
 * Dropdown action button (for multiple items)
 */
function ActionDropdown({
    label,
    icon,
    items,
    onItemClick,
    onSaveAll,
    isDark,
}: {
    label: string;
    icon: React.ReactNode;
    items: ActionItem[];
    onItemClick: (url: string) => void;
    onSaveAll?: () => void;
    isDark: boolean;
}) {
    const styles = getStyles(isDark);
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<number | null>(null);

    // Track saving status for individual items and "Save All" button
    const [itemStatuses, setItemStatuses] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
    const [saveAllStatus, setSaveAllStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const handleItemClick = async (url: string, index: number) => {
        const itemKey = `${url}-${index}`;
        if (itemStatuses[itemKey] === 'saving' || itemStatuses[itemKey] === 'saved') return;

        setItemStatuses(prev => ({ ...prev, [itemKey]: 'saving' }));
        try {
            await onItemClick(url);
            setItemStatuses(prev => ({ ...prev, [itemKey]: 'saved' }));
            // Optional: reset to idle after 3 seconds if menu stays open
            setTimeout(() => {
                setItemStatuses(prev => ({ ...prev, [itemKey]: 'idle' }));
            }, 3000);
        } catch (e) {
            setItemStatuses(prev => ({ ...prev, [itemKey]: 'idle' }));
        }
    };

    const handleSaveAllClick = async () => {
        if (!onSaveAll || saveAllStatus === 'saving' || saveAllStatus === 'saved') return;

        setSaveAllStatus('saving');
        try {
            await onSaveAll();
            setSaveAllStatus('saved');
            setTimeout(() => {
                setSaveAllStatus('idle');
                setOpen(false); // Close after showing success
            }, 1000);
        } catch (e) {
            setSaveAllStatus('idle');
        }
    };

    return (
        <DropdownMenuPrimitive.Root open={open} onOpenChange={(isOpen) => {
            // Prevent closing if anything is saving
            const isSaving = Object.values(itemStatuses).includes('saving') || saveAllStatus === 'saving';
            if (!isOpen && isSaving) return;
            setOpen(isOpen);
        }}>
            <div
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => {
                    const isSaving = Object.values(itemStatuses).includes('saving') || saveAllStatus === 'saving';
                    if (!isSaving) setOpen(false);
                }}
            >
                <DropdownMenuPrimitive.Trigger asChild>
                    <button
                        style={{
                            ...styles.actionButton,
                            ...(hovered ? styles.actionButtonHover : {}),
                        }}
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                        title={`${label} (${items.length})`}
                    >
                        <span style={styles.actionIcon}>{icon}</span>
                        <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
                        <span style={styles.badge}>{items.length}</span>
                    </button>
                </DropdownMenuPrimitive.Trigger>
                {/* Use Content directly WITHOUT Portal for Shadow DOM */}
                <DropdownMenuPrimitive.Content
                    side="right"
                    align="start"
                    sideOffset={18}
                    className="ext-lw-void-dropdown-outer ext-lw-capture-dropdown-outer"
                    style={{
                        zIndex: 2147483647,
                        filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.2))',
                        padding: '4px',
                        background: isDark ? '#09090b' : '#e9e9e5', // Direct sync
                        display: 'flex',
                    }}
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                >
                    <div className="ext-lw-void-dropdown" style={{ minWidth: '180px', maxHeight: '280px', overflow: 'hidden' }}>
                        <div
                            style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {items.map((item, index) => {
                                const status = itemStatuses[`${item.url}-${index}`] || 'idle';
                                const currentIcon = status === 'saving' ? SPINNER_ICON : status === 'saved' ? CHECK_ICON : icon;

                                return (
                                    <button
                                        key={`${item.url}-${index}`}
                                        style={{
                                            ...styles.dropdownItem,
                                            outline: 'none',
                                            ...(hoveredItem === index ? { background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' } : {}),
                                            opacity: status === 'saving' ? 0.7 : 1,
                                            cursor: status === 'saving' ? 'default' : 'pointer',
                                        }}
                                        onMouseEnter={() => setHoveredItem(index)}
                                        onMouseLeave={() => setHoveredItem(null)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleItemClick(item.url, index);
                                        }}
                                        title={item.url}
                                        disabled={status === 'saving'}
                                    >
                                        <span style={{ ...styles.actionIcon, opacity: status === 'idle' ? 0.6 : 1 }}>{currentIcon}</span>
                                        <span style={{
                                            ...styles.dropdownItemUrl,
                                            color: status === 'saved' ? '#10b981' : undefined
                                        }}>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {onSaveAll && (
                            <button
                                className="ext-lw-capture-save-all"
                                style={{
                                    ...styles.saveAllButton,
                                    outline: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    opacity: saveAllStatus === 'saving' ? 0.7 : 1,
                                    cursor: saveAllStatus === 'saving' ? 'default' : 'pointer',
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveAllClick();
                                }}
                                disabled={saveAllStatus === 'saving'}
                            >
                                {saveAllStatus === 'saving' ? SPINNER_ICON : saveAllStatus === 'saved' ? CHECK_ICON : null}
                                {i18n.t('highlightToolbox.saveAll')}
                            </button>
                        )}
                    </div>
                </DropdownMenuPrimitive.Content>
            </div>
        </DropdownMenuPrimitive.Root>
    );
}

/**
 * CaptureDock - Main component
 */
export function CaptureDock({ target, isDark, callbacks, faviconUrl }: CaptureDockProps) {
    const styles = getStyles(isDark);
    const [closeHovered, setCloseHovered] = React.useState(false);

    // Build action list based on target content
    const actions: CaptureActionType[] = [];

    // 1. Highlight (for text content)
    if (
        ContentExtractor.hasTextContent(target) ||
        (!ContentExtractor.hasLink(target) &&
            !ContentExtractor.hasImage(target) &&
            !ContentExtractor.hasVideo(target) &&
            !ContentExtractor.hasFile(target))
    ) {
        actions.push('highlight');
    }

    // 2. Add Note (Universal)
    actions.push('add_note');

    // 3. Clip (Universal)
    actions.push('clip');

    // 4. Save options (contextual)
    if (ContentExtractor.hasLink(target)) actions.push('save_link');
    if (ContentExtractor.hasImage(target)) actions.push('save_image');
    if (ContentExtractor.hasVideo(target)) actions.push('save_video');
    if (ContentExtractor.hasFile(target)) actions.push('save_file');

    // Extract content
    const links = ContentExtractor.getLinks(target);
    const linksWithLabels = ContentExtractor.getLinksWithLabels(target);
    const images = ContentExtractor.getImages(target);
    const videos = ContentExtractor.getVideos(target);
    const files = ContentExtractor.getFiles(target);

    // Handle action click
    const handleAction = async (action: CaptureActionType, url?: string) => {
        const actionTarget = url ? { ...target, url } : target;

        switch (action) {
            case 'highlight':
                await callbacks.onHighlight(actionTarget);
                break;
            case 'add_note':
                await callbacks.onAddNote(actionTarget);
                break;
            case 'clip':
                await callbacks.onClip(actionTarget);
                break;
            case 'save_link':
                await callbacks.onSaveLink(actionTarget);
                break;
            case 'save_image':
                await callbacks.onSaveImage(actionTarget);
                break;
            case 'save_video':
                await callbacks.onSaveImage(actionTarget);
                break;
            case 'save_file':
                await callbacks.onSaveFile(actionTarget);
                break;
        }
    };



    return (
        <div className="ext-lw-capture-actionbar-inner" style={styles.inner}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <img src={faviconUrl} width="18" height="18" alt="" style={{ borderRadius: '4px' }} />
                    <span style={styles.headerTitle}>
                        {i18n.t('smartActions.title')}
                    </span>
                </div>
                <button
                    style={{
                        ...styles.closeButton,
                        ...(closeHovered ? { background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' } : {}),
                    }}
                    onMouseEnter={() => setCloseHovered(true)}
                    onMouseLeave={() => setCloseHovered(false)}
                    onClick={callbacks.onClose}
                    title={i18n.t('smartActions.close')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
                    </svg>
                </button>
            </div>

            {/* Actions */}
            <div style={styles.actionsContainer}>
                {actions.map((action) => {
                    const icon = ACTION_ICONS[action];
                    let label = i18n.t(ACTION_LABELS[action]);

                    // Dynamic label for save_file
                    if (action === 'save_file') {
                        const fileUrl = target.secondaryUrl || target.url;
                        if (fileUrl) {
                            label = getFileTypeLabel(fileUrl);
                        }
                    }

                    // Multi-item dropdowns
                    if (action === 'save_link' && links.length > 1) {
                        return (
                            <ActionDropdown
                                key={action}
                                label={i18n.t('smartActions.saveLink')}
                                icon={icon}
                                items={linksWithLabels}
                                onItemClick={(url) => handleAction('save_link', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(links, 'LINK') : undefined}
                                isDark={isDark}
                            />
                        );
                    }

                    if (action === 'save_image' && images.length > 1) {
                        return (
                            <ActionDropdown
                                key={action}
                                label={i18n.t('smartActions.saveImage')}
                                icon={icon}
                                items={images.map((url) => ({ url, label: truncateUrl(url) }))}
                                onItemClick={(url) => handleAction('save_image', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(images, 'IMAGE') : undefined}
                                isDark={isDark}
                            />
                        );
                    }

                    if (action === 'save_video' && videos.length > 1) {
                        return (
                            <ActionDropdown
                                key={action}
                                label={i18n.t('smartActions.saveVideo')}
                                icon={icon}
                                items={videos.map((url) => ({ url, label: truncateUrl(url) }))}
                                onItemClick={(url) => handleAction('save_video', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(videos, 'VIDEO') : undefined}
                                isDark={isDark}
                            />
                        );
                    }

                    if (action === 'save_file' && files.length > 1) {
                        return (
                            <ActionDropdown
                                key={action}
                                label={i18n.t('smartActions.saveFile')}
                                icon={icon}
                                items={files}
                                onItemClick={(url) => handleAction('save_file', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(files.map(f => f.url), 'FILE') : undefined}
                                isDark={isDark}
                            />
                        );
                    }

                    // Single action button
                    return (
                        <ActionButton
                            key={action}
                            label={label}
                            icon={icon}
                            onClick={() => handleAction(action)}
                            isDark={isDark}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default CaptureDock;
