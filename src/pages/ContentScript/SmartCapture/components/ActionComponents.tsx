/**
 * ActionDropdown - Dropdown action button for multiple items
 */

import React, { useState } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import i18n from '../../../../@/lib/i18n';
import { getCaptureDockStyles } from './CaptureDockStyles';
import { SPINNER_ICON, CHECK_ICON } from './CaptureDockIcons';

interface ActionItem {
    url: string;
    label: string;
}

export function ActionButton({
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
    const styles = getCaptureDockStyles(isDark);
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

export function ActionDropdown({
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
    const styles = getCaptureDockStyles(isDark);
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<number | null>(null);
    const [itemStatuses, setItemStatuses] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
    const [saveAllStatus, setSaveAllStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const handleItemClick = async (url: string, index: number) => {
        const itemKey = `${url}-${index}`;
        if (itemStatuses[itemKey] === 'saving' || itemStatuses[itemKey] === 'saved') return;

        setItemStatuses(prev => ({ ...prev, [itemKey]: 'saving' }));
        try {
            await onItemClick(url);
            setItemStatuses(prev => ({ ...prev, [itemKey]: 'saved' }));
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
                setOpen(false);
            }, 1000);
        } catch (e) {
            setSaveAllStatus('idle');
        }
    };

    return (
        <DropdownMenuPrimitive.Root open={open} onOpenChange={(isOpen) => {
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
                <DropdownMenuPrimitive.Content
                    side="right"
                    align="start"
                    sideOffset={18}
                    className="ext-lw-void-dropdown-outer ext-lw-capture-dropdown-outer"
                    style={{
                        zIndex: 2147483647,
                        filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.2))',
                        padding: '4px',
                        background: isDark ? '#09090b' : '#e9e9e5',
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
