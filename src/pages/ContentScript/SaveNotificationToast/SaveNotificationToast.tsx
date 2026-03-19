/**
 * SaveNotificationToast - Main toast component for save notifications
 * Supports stacked cards with expand/collapse animation
 */

import { useState, useEffect, useCallback } from 'react';
import { X, CaretDown } from '@phosphor-icons/react';
import { getToastStyles, useIsDark } from './toastStyles';
import { ToastCard } from './ToastCard';
import type { SaveNotificationToastProps } from './types';

export const SaveNotificationToast = ({
    links,
    newLinkIds: _newLinkIds,
    onClose,
    onEdit,
    onShow,
    autoCloseDelay = 5000
}: SaveNotificationToastProps) => {
    const isDark = useIsDark();
    const styles = getToastStyles(isDark);

    const [isClosing, setIsClosing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isCollapsing, setIsCollapsing] = useState(false);
    const [closeBtnHovered, setCloseBtnHovered] = useState(false);
    const [hasAnimatedIn, setHasAnimatedIn] = useState(false);

    const hasMultiple = links.length > 1;
    const tailLinks = hasMultiple ? links.slice(1, 2) : [];
    const remainingCount = links.length > 2 ? links.length - 2 : 0;

    useEffect(() => {
        const timer = setTimeout(() => setHasAnimatedIn(true), 350);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isHovered || isExpanded || isClosing) return;

        const timer = setTimeout(() => {
            setIsClosing(true);
            setTimeout(() => { onClose(); }, 300);
        }, autoCloseDelay);

        return () => clearTimeout(timer);
    }, [isHovered, isExpanded, isClosing, autoCloseDelay, links.length]);

    const handleExpand = useCallback(() => {
        if (isExpanded) {
            setIsCollapsing(true);
            setTimeout(() => {
                setIsExpanded(false);
                setIsCollapsing(false);
            }, 250);
        } else {
            setIsExpanded(true);
        }
    }, [isExpanded]);

    return (
        <div
            style={{
                position: 'fixed',
                top: '16px',
                right: '16px',
                zIndex: 2147483647,
                width: '320px',
                transition: 'all 0.3s ease',
                transform: isClosing ? 'translateX(120%)' : 'translateX(0)',
                opacity: isClosing ? 0 : 1,
                animation: hasAnimatedIn ? 'none' : 'ext-lw-slide-in-right 0.3s ease-out',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                maxHeight: isExpanded ? 'calc(100vh - 32px)' : 'auto',
                overflowY: isExpanded ? 'auto' : 'visible',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onWheel={(e) => { e.stopPropagation(); }}
        >
            {/* Close button - only visible on hover */}
            {isHovered && (
                <button
                    onClick={() => {
                        setIsClosing(true);
                        setTimeout(onClose, 300);
                    }}
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        zIndex: 10,
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: 'none',
                        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.8)' : 'rgba(228, 228, 231, 0.9)',
                        color: isDark ? '#a1a1aa' : '#71717a',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        ...(closeBtnHovered ? { backgroundColor: isDark ? '#3f3f46' : '#d4d4d8' } : {}),
                    }}
                    onMouseEnter={() => setCloseBtnHovered(true)}
                    onMouseLeave={() => setCloseBtnHovered(false)}
                >
                    <X style={{ width: 14, height: 14 }} />
                </button>
            )}

            {/* Main Card */}
            <ToastCard
                link={links[0]}
                isMain={true}
                onEdit={onEdit ? (link) => {
                    setIsClosing(true);
                    setTimeout(() => onEdit(link), 300);
                } : undefined}
                onShow={onShow ? (link) => {
                    setIsClosing(true);
                    setTimeout(() => onShow(link), 300);
                } : undefined}
            />

            {/* Tail Cards (stacked) */}
            {hasMultiple && !isExpanded && (
                <div
                    style={{
                        position: 'relative',
                        cursor: 'pointer',
                        marginTop: '-8px',
                        paddingTop: '8px',
                        pointerEvents: 'auto',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleExpand(); }}
                >
                    {tailLinks.map((link, index) => (
                        <div
                            key={link.id}
                            style={{
                                width: `calc(100% - ${(index + 1) * 16}px)`,
                                marginTop: index === 0 ? 0 : '-4px',
                                opacity: 1 - (index * 0.2),
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                transition: 'all 0.2s ease',
                                pointerEvents: 'auto',
                            }}
                        >
                            <div style={styles.tail}>
                                {index === tailLinks.length - 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: isDark ? '#a1a1aa' : '#71717a' }}>
                                        <CaretDown style={{ width: 12, height: 12 }} />
                                        <span>
                                            {remainingCount > 0
                                                ? `+${remainingCount + tailLinks.length} more`
                                                : `+${tailLinks.length} more`
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Expanded Cards */}
            {isExpanded && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '8px',
                    animation: isCollapsing
                        ? 'ext-lw-collapse-stack 0.25s ease-in forwards'
                        : 'ext-lw-expand-stack 0.3s ease-out',
                }}>
                    {links.slice(1).map(link => (
                        <ToastCard
                            key={link.id}
                            link={link}
                            isExpanded={true}
                            onEdit={onEdit ? (l) => {
                                setIsClosing(true);
                                setTimeout(() => onEdit(l), 300);
                            } : undefined}
                            onShow={onShow ? (l) => {
                                setIsClosing(true);
                                setTimeout(() => onShow(l), 300);
                            } : undefined}
                        />
                    ))}
                    <button
                        onClick={handleExpand}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'opacity 0.2s',
                            opacity: 0.6,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                        <CaretDown style={{ width: 14, height: 14, transform: 'rotate(180deg)', color: '#a1a1aa' }} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default SaveNotificationToast;
