/**
 * CaptureDock - Main component for CaptureActionBar UI
 * Uses inline styles for Shadow DOM compatibility
 */

import React from 'react';
import { CaptureActionType, CaptureTarget, getFileTypeLabel, SmartCaptureCallbacks } from '../types';
import { ContentExtractor } from '../../shared/ContentExtractor';
import i18n from '../../../../@/lib/i18n';
import { getCaptureDockStyles, truncateUrl } from './CaptureDockStyles';
import { ACTION_ICONS, ACTION_LABELS, ADD_NOTE_FILLED_ICON } from './CaptureDockIcons';
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
    // Per-action feedback state (mirrors HighlightToolbox pattern). Currently only
    // wired for 'highlight' — toolbox parity. After tick the action bar self-closes
    // since Smart Capture deactivate is the natural next step post-success.
    const [successAction, setSuccessAction] = React.useState<CaptureActionType | null>(null);
    const [pendingAction, setPendingAction] = React.useState<CaptureActionType | null>(null);
    const successTimerRef = React.useRef<number | null>(null);

    // CaptureActionBar reuses the same React tree across shows — it only swaps
    // props via reactRoot.render(). Without this reset, a previous "Done" state
    // would persist when the user invokes smart actions for the next element.
    React.useEffect(() => {
        setSuccessAction(null);
        setPendingAction(null);
        if (successTimerRef.current !== null) {
            clearTimeout(successTimerRef.current);
            successTimerRef.current = null;
        }
    }, [target]);

    React.useEffect(() => {
        return () => {
            if (successTimerRef.current !== null) {
                clearTimeout(successTimerRef.current);
                successTimerRef.current = null;
            }
        };
    }, []);

    // Detect highlight spans inside (or wrapping) the target element. If any are
    // found we replace the 'highlight' action with 'erase' — re-highlighting an
    // already-highlighted block produces stacked spans on top of the existing
    // tint, which is what the user reported. Mirrors the toolbox heuristic of
    // showing the eraser when the selection sits on an existing highlight.
    // Also surfaces whether any of those highlights carry a saved comment, so the
    // add_note button can flip to "Edit Note" + filled icon.
    const { existingHighlightIds, hasExistingComment } = React.useMemo(() => {
        const el = target.elementRef;
        if (!el) return { existingHighlightIds: [] as number[], hasExistingComment: false };
        const ids = new Set<number>();
        let hasComment = false;
        const collect = (node: Element | null) => {
            if (!node) return;
            const ext = node.getAttribute('data-ext-lw-highlight-id');
            if (ext) ids.add(parseInt(ext, 10));
            const app = node.getAttribute('data-highlight-id');
            if (app) ids.add(parseInt(app, 10));
            if (node.classList?.contains('ext-lw-has-comment')) hasComment = true;
        };
        collect(el.closest('[data-ext-lw-highlight-id], [data-highlight-id]'));
        el.querySelectorAll('[data-ext-lw-highlight-id], [data-highlight-id]').forEach(collect);
        return {
            existingHighlightIds: Array.from(ids).filter(n => Number.isFinite(n) && n > 0),
            hasExistingComment: hasComment,
        };
    }, [target]);
    const hasExistingHighlight = existingHighlightIds.length > 0 && !!callbacks.onErase;

    // Build action list based on target content
    const actions: CaptureActionType[] = [];

    if (
        ContentExtractor.hasTextContent(target) ||
        (!ContentExtractor.hasLink(target) &&
            !ContentExtractor.hasImage(target) &&
            !ContentExtractor.hasVideo(target) &&
            !ContentExtractor.hasFile(target))
    ) {
        actions.push(hasExistingHighlight ? 'erase' : 'highlight');
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
        // Allow other actions to fire even when one button sits in a permanent
        // success state (e.g. clip). Only block when something is in flight or
        // the user is re-clicking the same successful button.
        if (pendingAction) return;
        if (successAction === action) return;
        const actionTarget = url ? { ...target, url } : target;

        // Highlight & erase share the same inline tick + "Done" feedback pattern
        // (toolbox parity). Other actions keep their existing behavior — they
        // either close the bar themselves (clip/save_*) or open a panel (add_note).
        // After tick, prefer onReopen so the bar refreshes its layout (highlight
        // becomes erase and vice versa). Falls back to onClose if host didn't
        // wire reopen support.
        const finalize = () => {
            successTimerRef.current = null;
            if (callbacks.onReopen) callbacks.onReopen();
            else callbacks.onClose();
        };

        if (action === 'highlight') {
            setPendingAction('highlight');
            try {
                await callbacks.onHighlight(actionTarget);
                setSuccessAction('highlight');
                successTimerRef.current = window.setTimeout(finalize, 950);
            } finally {
                setPendingAction(null);
            }
            return;
        }

        if (action === 'erase') {
            if (!callbacks.onErase || existingHighlightIds.length === 0) return;
            setPendingAction('erase');
            try {
                await callbacks.onErase(actionTarget, existingHighlightIds);
                setSuccessAction('erase');
                successTimerRef.current = window.setTimeout(finalize, 950);
            } finally {
                setPendingAction(null);
            }
            return;
        }

        // Clip gets inline tick + "Done" but stays in that state — no auto-close,
        // no reopen. User explicitly wants the visual confirmation to persist
        // while leaving the rest of the bar usable for follow-up actions.
        if (action === 'clip') {
            setPendingAction('clip');
            try {
                await callbacks.onClip(actionTarget);
                setSuccessAction('clip');
            } finally {
                setPendingAction(null);
            }
            return;
        }

        switch (action) {
            case 'add_note': await callbacks.onAddNote(actionTarget); break;
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
                    let icon = ACTION_ICONS[action];
                    let label = i18n.t(ACTION_LABELS[action]);

                    if (action === 'save_file') {
                        const fileUrl = target.secondaryUrl || target.url;
                        if (fileUrl) label = getFileTypeLabel(fileUrl);
                    }

                    // Element already has a highlight with a saved comment →
                    // surface "Edit Note" + filled icon instead of the default
                    // outline "Add Note" affordance.
                    if (action === 'add_note' && hasExistingComment) {
                        icon = ADD_NOTE_FILLED_ICON;
                        label = i18n.t('highlightToolbox.editNote');
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

                    // Cross-button lock only matters during auto-closing successes
                    // (highlight/erase) where the bar is about to swap state in 950ms.
                    // For permanent successes (clip), other buttons stay live so the
                    // user can chain capture → highlight → add_note on the same target.
                    const autoClosingActive = successAction === 'highlight' || successAction === 'erase';
                    const isDisabled =
                        pendingAction === action ||
                        successAction === action ||
                        (autoClosingActive && successAction !== action);
                    return (
                        <ActionButton key={action} label={label} icon={icon}
                            onClick={() => handleAction(action)} isDark={isDark}
                            success={successAction === action}
                            disabled={isDisabled} />
                    );
                })}
            </div>
        </div>
    );
}

export default CaptureDock;
