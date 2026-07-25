/**
 * ToastCard - Single card component for save notification
 * Matches SavedLinkCard.tsx structure
 */

import { useState } from 'react';
import { FolderSimple } from '@phosphor-icons/react';
import { getToastStyles, useIsDark } from './toastStyles';
import type { PreparedToastLink, ToastLabels } from './types';

export const ToastCard = ({
    link,
    labels,
    isMain = false,
    isExpanded = false,
    onClick,
    onEdit,
    onShow,
}: {
    link: PreparedToastLink;
    labels: ToastLabels;
    isMain?: boolean;
    isExpanded?: boolean;
    onClick?: () => void;
    onEdit?: (link: PreparedToastLink) => void;
    onShow?: (link: PreparedToastLink) => void;
}) => {
    const isDark = useIsDark();
    const styles = getToastStyles(isDark);

    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

    const faviconUrl = link.url ? 'https://www.google.com/s2/favicons?sz=64&domain_url=' + link.url : '';
    const displayImage = link.thumbnailSrc || faviconUrl;
    const hasPreviewImage = Boolean(link.thumbnailSrc && link.thumbnailSrc !== faviconUrl);

    return (
        <div
            style={{
                ...styles.card,
                cursor: !isMain ? 'pointer' : 'default',
            }}
            onClick={!isMain ? onClick : undefined}
        >
            <div style={styles.cardContent}>
                <div style={styles.thumbnail}>
                    <img
                        src={displayImage}
                        alt=""
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: hasPreviewImage ? 'cover' : 'contain',
                            padding: hasPreviewImage ? 0 : '8px',
                            borderRadius: '12px',
                        }}
                        onError={(e) => {
                            if (faviconUrl && e.currentTarget.src !== faviconUrl) {
                                e.currentTarget.src = faviconUrl;
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

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}>
                    <h3 style={styles.title} title={link.name}>
                        {link.name}
                    </h3>
                    <div style={styles.meta}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {link.fallbackIconColor ? (
                                <span
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 4,
                                        flexShrink: 0,
                                        backgroundColor: link.fallbackIconColor,
                                        display: 'inline-block',
                                    }}
                                />
                            ) : link.collection?.color ? (
                                <FolderSimple style={{ width: 14, height: 14, flexShrink: 0, color: link.collection.color }} weight="fill" />
                            ) : (
                                <FolderSimple style={{ width: 14, height: 14, flexShrink: 0, color: '#a1a1aa' }} weight="fill" />
                            )}
                            {link.collectionLabel || labels.unorganized}
                        </span>
                        <span style={styles.dot}>•</span>
                        <span>{link.formattedDate}</span>
                    </div>
                </div>
            </div>

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
                            {labels.edit}
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
                            {labels.show}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
