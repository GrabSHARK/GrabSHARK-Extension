/**
 * CaptureDock - Main component for CaptureActionBar UI
 * Uses inline styles for Shadow DOM compatibility
 */

import React from 'react';
import { CaptureActionType, CaptureTarget, getFileTypeLabel, SmartCaptureCallbacks } from '../types';
import { ContentExtractor } from '../../shared/ContentExtractor';
import i18n from '../../../../@/lib/i18n';
import { getCaptureDockStyles, truncateUrl } from './CaptureDockStyles';
import { ACTION_ICONS, ACTION_LABELS } from './CaptureDockIcons';
import { ActionButton, ActionDropdown } from './ActionComponents';

interface CaptureDockProps {
    target: CaptureTarget;
    isDark: boolean;
    callbacks: SmartCaptureCallbacks;
    faviconUrl: string;
}

export function CaptureDock({ target, isDark, callbacks, faviconUrl }: CaptureDockProps) {
    const styles = getCaptureDockStyles(isDark);
    const [closeHovered, setCloseHovered] = React.useState(false);

    // Build action list based on target content
    const actions: CaptureActionType[] = [];

    if (
        ContentExtractor.hasTextContent(target) ||
        (!ContentExtractor.hasLink(target) &&
            !ContentExtractor.hasImage(target) &&
            !ContentExtractor.hasVideo(target) &&
            !ContentExtractor.hasFile(target))
    ) {
        actions.push('highlight');
    }

    actions.push('add_note');
    actions.push('clip');

    if (ContentExtractor.hasLink(target)) actions.push('save_link');
    if (ContentExtractor.hasImage(target)) actions.push('save_image');
    if (ContentExtractor.hasVideo(target)) actions.push('save_video');
    if (ContentExtractor.hasFile(target)) actions.push('save_file');

    const links = ContentExtractor.getLinks(target);
    const linksWithLabels = ContentExtractor.getLinksWithLabels(target);
    const images = ContentExtractor.getImages(target);
    const videos = ContentExtractor.getVideos(target);
    const files = ContentExtractor.getFiles(target);

    const handleAction = async (action: CaptureActionType, url?: string) => {
        const actionTarget = url ? { ...target, url } : target;

        switch (action) {
            case 'highlight': await callbacks.onHighlight(actionTarget); break;
            case 'add_note': await callbacks.onAddNote(actionTarget); break;
            case 'clip': await callbacks.onClip(actionTarget); break;
            case 'save_link': await callbacks.onSaveLink(actionTarget); break;
            case 'save_image': await callbacks.onSaveImage(actionTarget); break;
            case 'save_video': await callbacks.onSaveImage(actionTarget); break;
            case 'save_file': await callbacks.onSaveFile(actionTarget); break;
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

                    if (action === 'save_file') {
                        const fileUrl = target.secondaryUrl || target.url;
                        if (fileUrl) label = getFileTypeLabel(fileUrl);
                    }

                    // Multi-item dropdowns
                    if (action === 'save_link' && links.length > 1) {
                        return (
                            <ActionDropdown key={action} label={i18n.t('smartActions.saveLink')} icon={icon}
                                items={linksWithLabels} onItemClick={(url) => handleAction('save_link', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(links, 'LINK') : undefined}
                                isDark={isDark} />
                        );
                    }

                    if (action === 'save_image' && images.length > 1) {
                        return (
                            <ActionDropdown key={action} label={i18n.t('smartActions.saveImage')} icon={icon}
                                items={images.map((url) => ({ url, label: truncateUrl(url) }))}
                                onItemClick={(url) => handleAction('save_image', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(images, 'IMAGE') : undefined}
                                isDark={isDark} />
                        );
                    }

                    if (action === 'save_video' && videos.length > 1) {
                        return (
                            <ActionDropdown key={action} label={i18n.t('smartActions.saveVideo')} icon={icon}
                                items={videos.map((url) => ({ url, label: truncateUrl(url) }))}
                                onItemClick={(url) => handleAction('save_video', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(videos, 'VIDEO') : undefined}
                                isDark={isDark} />
                        );
                    }

                    if (action === 'save_file' && files.length > 1) {
                        return (
                            <ActionDropdown key={action} label={i18n.t('smartActions.saveFile')} icon={icon}
                                items={files} onItemClick={(url) => handleAction('save_file', url)}
                                onSaveAll={callbacks.onSaveBatch ? () => callbacks.onSaveBatch!(files.map(f => f.url), 'FILE') : undefined}
                                isDark={isDark} />
                        );
                    }

                    return (
                        <ActionButton key={action} label={label} icon={icon}
                            onClick={() => handleAction(action)} isDark={isDark} />
                    );
                })}
            </div>
        </div>
    );
}

export default CaptureDock;
