/**
 * ToastCard - Single card component for save notification
 * Matches SavedLinkCard.tsx structure
 */

import { useState, useEffect } from 'react';
import { FolderSimple } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import Icon from '../../../@/components/Icon';
import { getThumbnail } from '../../../@/lib/thumbnailCache';
import { getToastStyles, useIsDark } from './toastStyles';
import type { ToastLinkData } from './types';

export const ToastCard = ({
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
    const styles = getToastStyles(isDark);

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
                {/* Thumbnail */}
                <div style={styles.thumbnail}>
                    <img
                        src={imgSrc || faviconUrl}
                        alt=""
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: imgSrc && imgSrc !== faviconUrl ? 'cover' : 'contain',
                            padding: imgSrc && imgSrc !== faviconUrl ? 0 : '8px',
                            borderRadius: '12px',
                        }}
                        onError={(e) => {
                            if (faviconUrl && (e.target as HTMLImageElement).src !== faviconUrl) {
                                (e.target as HTMLImageElement).src = faviconUrl;
                            }
                        }}
                    />
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
