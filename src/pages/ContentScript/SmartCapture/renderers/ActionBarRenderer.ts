/**
 * ActionBarRenderer - Pure UI rendering for CaptureActionBar
 * 
 * Features:
 * - Generate header HTML with close button
 * - Generate action button HTML with icons
 * - Generate dropdown menus for multiple items
 * - HTML escaping utilities
 * - URL truncation for display
 * 
 * Used by: CaptureActionBar
 */

import { CaptureActionType, CaptureTarget, getFileTypeLabel } from '../types';
import { ContentExtractor } from '../../shared/ContentExtractor';
import i18n from '../../../../@/lib/i18n';

/** Action definitions with Bootstrap Icons */
export const ACTION_DEFINITIONS: Record<CaptureActionType, { icon: string; label: string }> = {
    save_link: {
        // bi-link-45deg
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-link-45deg" viewBox="0 0 16 16">
  <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z"/>
  <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z"/>
</svg>`,
        label: 'smartActions.saveLink',
    },
    save_image: {
        // bi-image
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-image" viewBox="0 0 16 16">
  <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
  <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1z"/>
</svg>`,
        label: 'smartActions.saveImage',
    },
    save_video: {
        // bi-camera-video
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/>
</svg>`,
        label: 'smartActions.saveVideo',
    },
    save_file: {
        // bi-file-earmark-arrow-down
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-arrow-down" viewBox="0 0 16 16">
  <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293z"/>
  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
</svg>`,
        label: 'smartActions.saveFile',
    },
    highlight: {
        // bi-highlighter
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-highlighter" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M11.096.644a2 2 0 0 1 2.791.036l1.433 1.433a2 2 0 0 1 .035 2.791l-.413.435-8.07 8.995a.5.5 0 0 1-.372.166h-3a.5.5 0 0 1-.234-.058l-.412.412A.5.5 0 0 1 2.5 15h-2a.5.5 0 0 1-.354-.854l1.412-1.412A.5.5 0 0 1 1.5 12.5v-3a.5.5 0 0 1 .166-.372l8.995-8.07zm-.115 1.47L2.727 9.52l3.753 3.753 7.406-8.254zm3.585 2.17.064-.068a1 1 0 0 0-.017-1.396L13.18 1.387a1 1 0 0 0-1.396-.018l-.068.065zM5.293 13.5 2.5 10.707v1.586L3.707 13.5z"/>
</svg>`,
        label: 'smartActions.highlight',
    },
    clip: {
        // bi-crop
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path d="M3.5.5A.5.5 0 0 1 4 1v13h13a.5.5 0 0 1 0 1h-2v2a.5.5 0 0 1-1 0v-2H3.5a.5.5 0 0 1-.5-.5V4H1a.5.5 0 0 1 0-1h2V1a.5.5 0 0 1 .5-.5m2.5 3a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4H6.5a.5.5 0 0 1-.5-.5"/>
  </svg>`,
        label: 'smartActions.clip',
    },
    add_note: {
        // bi-chat-square-dots
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chat-square-dots" viewBox="0 0 16 16">
    <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
    <path d="M5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
  </svg>`,
        label: 'smartActions.addNote',
    },
};

export interface RenderOptions {
    target: CaptureTarget;
    faviconUrl: string;
}

export class ActionBarRenderer {
    /**
     * Escape HTML special characters
     */
    public static escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Truncate URL for display
     */
    public static truncateUrl(url: string, maxLength: number = 50): string {
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
     * Render the header bar with title and close button
     */
    public static renderHeader(faviconUrl: string): string {
        return `
      <div class="ext-lw-capture-actionbar-header">
        <div class="ext-lw-capture-actionbar-title-container">
            <img src="${faviconUrl}" width="18" height="18" alt="" class="ext-lw-capture-actionbar-icon" />
            <span class="ext-lw-capture-actionbar-title">${i18n.t('smartActions.title')}</span>
        </div>
        <div class="ext-lw-capture-actionbar-header-actions">
            <button class="ext-lw-capture-action-header-btn" data-action="close" title="${i18n.t('smartActions.close')}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
              </svg>
            </button>
        </div>
      </div>
    `;
    }

    /**
     * Render a single action button
     */
    public static renderActionButton(action: CaptureActionType, label: string): string {
        const def = ACTION_DEFINITIONS[action];
        return `
        <button class="ext-lw-capture-action-btn" data-action="${action}" title="${label}">
          ${def.icon}
          <span class="ext-lw-capture-action-label">${label}</span>
        </button>
      `;
    }

    /**
     * Render a dropdown button with badge and items
     */
    public static renderDropdownButton(
        action: CaptureActionType,
        label: string,
        count: number,
        items: Array<{ url: string; label: string }>
    ): string {
        const def = ACTION_DEFINITIONS[action];
        return `
        <div class="ext-lw-capture-save-link-container" data-dropdown-type="${action}">
          <button class="ext-lw-capture-action-btn ext-lw-capture-action-btn-dropdown" data-action="${action}" title="${label} (${count})">
            ${def.icon}
            <span class="ext-lw-capture-action-label">${label}</span>
            <span class="ext-lw-link-count">${count}</span>
          </button>
          <div class="ext-lw-capture-link-dropdown ext-lw-capture-link-dropdown-hidden">
            <div class="ext-lw-capture-link-dropdown-scroll">
              ${items.map((item) => `
                <button class="ext-lw-capture-link-item" data-url="${ActionBarRenderer.escapeHtml(item.url)}" data-action-type="${action}" title="${ActionBarRenderer.escapeHtml(item.url)}">
                  ${def.icon}
                  <span class="ext-lw-capture-link-url">${ActionBarRenderer.escapeHtml(item.label)}</span>
                </button>
              `).join('')}
            </div>
            <button class="ext-lw-capture-link-all" data-action="save_all_${action.replace('save_', '')}s">${i18n.t('highlightToolbox.saveAll')}</button>
          </div>
        </div>
      `;
    }

    /**
     * Build and render action buttons for a target
     */
    public static renderActions(target: CaptureTarget): string {
        // Build unified action list dynamically based on target content
        const actions: CaptureActionType[] = [];

        // 1. Highlight (only for text content)
        if (ContentExtractor.hasTextContent(target) ||
            (!ContentExtractor.hasLink(target) &&
                !ContentExtractor.hasImage(target) &&
                !ContentExtractor.hasVideo(target) &&
                !ContentExtractor.hasFile(target))) {
            actions.push('highlight');
        }

        // 2. Add Note (Universal)
        actions.push('add_note');

        // 3. Capture (Universal)
        actions.push('clip');

        // 4. Save options (contextual - show all applicable)
        if (ContentExtractor.hasLink(target)) actions.push('save_link');
        if (ContentExtractor.hasImage(target)) actions.push('save_image');
        if (ContentExtractor.hasVideo(target)) actions.push('save_video');
        if (ContentExtractor.hasFile(target)) actions.push('save_file');

        // Get all extracted content
        const links = ContentExtractor.getLinks(target);
        const linksWithLabels = ContentExtractor.getLinksWithLabels(target);
        const images = ContentExtractor.getImages(target);
        const videos = ContentExtractor.getVideos(target);
        const files = ContentExtractor.getFiles(target);

        return actions.map((action) => {
            const def = ACTION_DEFINITIONS[action];
            let label = i18n.t(def.label);

            // Dynamic label for save_file based on file type
            if (action === 'save_file') {
                const fileUrl = target.secondaryUrl || target.url;
                if (fileUrl) {
                    label = getFileTypeLabel(fileUrl);
                }
            }

            // Special handling for save_link with multiple links
            if (action === 'save_link' && links.length > 1) {
                return ActionBarRenderer.renderDropdownButton(
                    'save_link',
                    i18n.t('smartActions.saveLink'),
                    linksWithLabels.length,
                    linksWithLabels
                );
            }

            // Special handling for save_image with multiple images
            if (action === 'save_image' && images.length > 1) {
                return ActionBarRenderer.renderDropdownButton(
                    'save_image',
                    i18n.t('smartActions.saveImage'),
                    images.length,
                    images.map(url => ({ url, label: ActionBarRenderer.truncateUrl(url) }))
                );
            }

            // Special handling for save_video with multiple videos
            if (action === 'save_video' && videos.length > 1) {
                return ActionBarRenderer.renderDropdownButton(
                    'save_video',
                    i18n.t('smartActions.saveVideo'),
                    videos.length,
                    videos.map(url => ({ url, label: ActionBarRenderer.truncateUrl(url) }))
                );
            }

            // Special handling for save_file with multiple files
            if (action === 'save_file' && files.length > 1) {
                return ActionBarRenderer.renderDropdownButton(
                    'save_file',
                    i18n.t('smartActions.saveFile'),
                    files.length,
                    files.map(f => ({ url: f.url, label: f.label }))
                );
            }

            return ActionBarRenderer.renderActionButton(action, label);
        }).join('');
    }

    /**
     * Render complete action bar content
     */
    public static renderComplete(options: RenderOptions): string {
        const headerHtml = ActionBarRenderer.renderHeader(options.faviconUrl);
        const actionsHtml = ActionBarRenderer.renderActions(options.target);

        return `
      ${headerHtml}
      <div class="ext-lw-capture-actionbar-actions">${actionsHtml}</div>
      <div class="ext-lw-capture-actionbar-shield"></div>
    `;
    }
}
