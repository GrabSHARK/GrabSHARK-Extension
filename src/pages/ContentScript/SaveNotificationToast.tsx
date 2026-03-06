import { useState, useEffect, useCallback } from 'react';
import { FolderSimple, X, CaretDown } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import Icon from '../../@/components/Icon';
import { getThumbnail } from '../../@/lib/thumbnailCache';

// Minimal link data for toast
export interface ToastLinkData {
    id: number;
    url: string;
    name: string;
    createdAt?: string;
    collection?: {
        name: string;
        color?: string;
        icon?: string;
    };
    preview?: string;
}

interface SaveNotificationToastProps {
    links: ToastLinkData[];
    newLinkIds?: number[]; // IDs of newly added links (for animation)
    onClose: () => void;
    onEdit?: (link: ToastLinkData) => void;
    onShow?: (link: ToastLinkData) => void;
    autoCloseDelay?: number;
}

// Match SavedLinkCard.tsx color values exactly
const getStyles = (isDark: boolean) => ({
    // Main card - matches: bg-[#e8e8eb] dark:bg-[#0c0c0e] rounded-2xl border border-zinc-200 dark:border-zinc-800/50 shadow-xl dark:shadow-black/40
    card: {
        backgroundColor: isDark ? '#0c0c0e' : '#e8e8eb',
        borderRadius: '16px', // rounded-2xl
        overflow: 'hidden' as const,
        border: isDark ? '1px solid rgba(39, 39, 42, 0.5)' : '1px solid #e4e4e7', // border-zinc-800/50 : border-zinc-200
        boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.4)' // shadow-black/40
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)', // shadow-xl
        transition: 'all 0.3s ease',
    },
    // Content padding - matches: p-4 flex gap-3
    cardContent: {
        padding: '16px', // p-4
        display: 'flex',
        gap: '12px', // gap-3
    },
    // Thumbnail - matches: w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700/50
    thumbnail: {
        flexShrink: 0,
        width: '64px', // w-16
        height: '64px', // h-16
        backgroundColor: isDark ? '#27272a' : '#e4e4e7', // bg-zinc-800 : bg-zinc-200
        borderRadius: '12px', // rounded-xl
        overflow: 'hidden' as const,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isDark ? '1px solid rgba(63, 63, 70, 0.5)' : '1px solid #e4e4e7', // border-zinc-700/50 : border-zinc-200
        position: 'relative' as const,
    },
    // Title - matches: text-sm font-semibold text-zinc-900 dark:text-zinc-100
    title: {
        fontSize: '14px', // text-sm
        fontWeight: 600, // font-semibold
        color: isDark ? '#f4f4f5' : '#18181b', // text-zinc-100 : text-zinc-900
        overflow: 'hidden' as const,
        textOverflow: 'ellipsis' as const,
        whiteSpace: 'nowrap' as const,
        paddingRight: '8px',
        margin: 0,
        lineHeight: 1.4,
    },
    // Meta - matches: text-xs text-zinc-500 dark:text-zinc-400 mt-1
    meta: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px', // gap-1.5
        fontSize: '12px', // text-xs
        color: isDark ? '#a1a1aa' : '#71717a', // text-zinc-400 : text-zinc-500
        marginTop: '4px', // mt-1
    },
    // Divider - matches: h-px bg-zinc-300 dark:bg-zinc-800/50
    divider: {
        height: '1px',
        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#d4d4d8', // bg-zinc-800/50 : bg-zinc-300
        width: '100%',
    },
    // Actions container - matches: divide-x divide-zinc-300 dark:divide-zinc-800/50
    actions: {
        display: 'flex',
    },
    // Action button - matches: py-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800/50
    actionBtn: {
        flex: 1,
        padding: '12px 8px', // py-3
        fontSize: '12px', // text-xs
        fontWeight: 600, // font-semibold
        color: isDark ? '#f4f4f5' : '#18181b', // text-zinc-100 : text-zinc-900
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
        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#e4e4e7', // hover:bg-zinc-800/50 : hover:bg-zinc-200
    },
    // Header - matches SavedLinkCard: mb-3 px-1, text-sm text-zinc-900 dark:text-zinc-100 font-medium
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px', // mb-3
        padding: '0 4px', // px-1
    },
    headerText: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px', // gap-2
        fontSize: '14px', // text-sm
        color: isDark ? '#f4f4f5' : '#18181b', // text-zinc-100 : text-zinc-900
        fontWeight: 500, // font-medium
    },
    // Check badge - matches: bg-blue-600 rounded-full p-1.5
    checkBadge: {
        backgroundColor: '#2563eb', // bg-blue-600
        borderRadius: '50%',
        padding: '6px', // p-1.5
        boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Close button - matches: hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full text-zinc-500
    closeBtn: {
        padding: '6px', // p-1.5
        borderRadius: '50%',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        color: '#71717a', // text-zinc-500
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnHover: {
        backgroundColor: isDark ? '#27272a' : '#e4e4e7', // hover:bg-zinc-800 : hover:bg-zinc-200
    },
    // Tail card (stacked)
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
    // Separator dot - matches: text-zinc-300 dark:text-zinc-700
    dot: {
        color: isDark ? '#3f3f46' : '#d4d4d8', // text-zinc-700 : text-zinc-300
    },
});

// Detect dark mode
const useIsDark = () => {
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

// Single card component - matches SavedLinkCard.tsx structure
const ToastCard = ({
    link,
    isMain = false,
    isExpanded = false,
    onClick,
    onEdit,
    onShow,
}: {
    link: ToastLinkData;
    isMain?: boolean;
    isExpanded?: boolean;
    onClick?: () => void;
    onEdit?: (link: ToastLinkData) => void;
    onShow?: (link: ToastLinkData) => void;
}) => {
    const { t, i18n } = useTranslation();
    const isDark = useIsDark();
    const styles = getStyles(isDark);

    const [imgSrc, setImgSrc] = useState<string>('');
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

    const faviconUrl = link.url ? `https://www.google.com/s2/favicons?sz=64&domain_url=${link.url}` : '';
    const formattedDate = link.createdAt
        ? format(new Date(link.createdAt), 'MMM d', { locale: i18n.language === 'tr' ? tr : enUS })
        : t('savedLink.justNow');
    const collectionName = link.collection?.name || t('bookmark.unorganized');

    useEffect(() => {
        const loadImage = async () => {
            const cached = await getThumbnail(link.url);
            if (cached) {
                setImgSrc(cached);
                return;
            }
            setImgSrc(faviconUrl);
        };
        loadImage();
    }, [link.url, faviconUrl]);

    return (
        <div
            style={{
                ...styles.card,
                cursor: !isMain ? 'pointer' : 'default',
            }}
            onClick={!isMain ? onClick : undefined}
        >
            <div style={styles.cardContent}>
                {/* Thumbnail - matches SavedLinkCard */}
                <div style={styles.thumbnail}>
                    <img
                        src={imgSrc || faviconUrl}
                        alt=""
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: imgSrc && imgSrc !== faviconUrl ? 'cover' : 'contain',
                            padding: imgSrc && imgSrc !== faviconUrl ? 0 : '8px', // p-2
                            borderRadius: '12px',
                        }}
                        onError={(e) => {
                            if (faviconUrl && (e.target as HTMLImageElement).src !== faviconUrl) {
                                (e.target as HTMLImageElement).src = faviconUrl;
                            }
                        }}
                    />
                    {/* Frame overlay - matches SavedLinkCard */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '12px',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                        pointerEvents: 'none',
                    }} />
                </div>

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}>
                    <h3 style={styles.title} title={link.name}>
                        {link.name}
                    </h3>
                    <div style={styles.meta}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {link.collection?.icon ? (
                                <Icon icon={link.collection.icon} style={{ width: 14, height: 14, flexShrink: 0 }} color={link.collection.color} />
                            ) : link.collection?.color ? (
                                <FolderSimple style={{ width: 14, height: 14, flexShrink: 0, color: link.collection.color }} weight="fill" />
                            ) : (
                                <FolderSimple style={{ width: 14, height: 14, flexShrink: 0, color: '#a1a1aa' }} weight="fill" />
                            )}
                            {collectionName}
                        </span>
                        <span style={styles.dot}>•</span>
                        <span>{formattedDate}</span>
                    </div>
                </div>
            </div>

            {/* Actions - only for main card or expanded */}
            {(isMain || isExpanded) && (
                <>
                    <div style={styles.divider} />
                    <div style={styles.actions}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit?.(link);
                            }}
                            style={{
                                ...styles.actionBtn,
                                ...(hoveredBtn === 'edit' ? styles.actionBtnHover : {}),
                            }}
                            onMouseEnter={() => setHoveredBtn('edit')}
                            onMouseLeave={() => setHoveredBtn(null)}
                        >
                            {t('savedLink.edit')}
                        </button>
                        {/* Full-height separator */}
                        <div style={{
                            width: '1px',
                            backgroundColor: isDark ? 'rgba(39, 39, 42, 0.5)' : '#d4d4d8',
                            alignSelf: 'stretch',
                        }} />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onShow?.(link);
                            }}
                            style={{
                                ...styles.actionBtn,
                                ...(hoveredBtn === 'show' ? styles.actionBtnHover : {}),
                            }}
                            onMouseEnter={() => setHoveredBtn('show')}
                            onMouseLeave={() => setHoveredBtn(null)}
                        >
                            Show
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export const SaveNotificationToast = ({
    links,
    newLinkIds: _newLinkIds, // Reserved for future animation enhancements
    onClose,
    onEdit,
    onShow,
    autoCloseDelay = 5000
}: SaveNotificationToastProps) => {
    const isDark = useIsDark();
    const styles = getStyles(isDark);

    const [isClosing, setIsClosing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isCollapsing, setIsCollapsing] = useState(false);
    const [closeBtnHovered, setCloseBtnHovered] = useState(false);
    const [hasAnimatedIn, setHasAnimatedIn] = useState(false);

    const hasMultiple = links.length > 1;
    const tailLinks = hasMultiple ? links.slice(1, 2) : []; // Show only 1 tail card
    const remainingCount = links.length > 2 ? links.length - 2 : 0;

    // Mark animation as complete after initial render
    useEffect(() => {
        const timer = setTimeout(() => setHasAnimatedIn(true), 350);
        return () => clearTimeout(timer);
    }, []);

    // Auto-close timer - resets when links.length changes (new links added)
    useEffect(() => {
        if (isHovered || isExpanded || isClosing) return;

        const timer = setTimeout(() => {
            setIsClosing(true);
            // Delay actual close to allow exit animation
            setTimeout(() => {
                onClose();
            }, 300);
        }, autoCloseDelay);

        return () => clearTimeout(timer);
    }, [isHovered, isExpanded, isClosing, autoCloseDelay, links.length]); // Added links.length to reset timer on new links

    const handleExpand = useCallback(() => {

        if (isExpanded) {
            // Collapse with animation
            setIsCollapsing(true);
            setTimeout(() => {
                setIsExpanded(false);
                setIsCollapsing(false);
            }, 250);
        } else {
            // Expand
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
            onWheel={(e) => {
                // Prevent scroll from propagating to the underlying page
                e.stopPropagation();
            }}
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
                        pointerEvents: 'auto', // Ensure clicks work
                    }}
                    onClick={(e) => {
                        e.stopPropagation();

                        handleExpand();
                    }}
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
