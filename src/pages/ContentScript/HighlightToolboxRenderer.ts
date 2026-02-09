// HighlightToolboxRenderer.ts
// Handles UI rendering logic for the Floating Highlight Toolbox
// Extracted from HighlightToolbox.ts to separate concerns due to file size constraints (God Object refactoring)

import { HighlightColor, HIGHLIGHT_COLORS } from '../../@/lib/types/highlight';
import i18n from '../../@/lib/i18n';
import { Highlight } from '../../@/lib/types/highlight';

// SVG Icons - Bootstrap Icons (adjusted sizes for visual balance)
export const ICONS = {
  // Highlighter icon (Bootstrap bi-highlighter)
  highlighter: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-highlighter" viewBox="0 0 16 16">
    <path fill-rule="evenodd" d="M11.096.644a2 2 0 0 1 2.791.036l1.433 1.433a2 2 0 0 1 .035 2.791l-.413.435-8.07 8.995a.5.5 0 0 1-.372.166h-3a.5.5 0 0 1-.234-.058l-.412.412A.5.5 0 0 1 2.5 15h-2a.5.5 0 0 1-.354-.854l1.412-1.412A.5.5 0 0 1 1.5 12.5v-3a.5.5 0 0 1 .166-.372l8.995-8.07zm-.115 1.47L2.727 9.52l3.753 3.753 7.406-8.254zm3.585 2.17.064-.068a1 1 0 0 0-.017-1.396L13.18 1.387a1 1 0 0 0-1.396-.018l-.068.065zM5.293 13.5 2.5 10.707v1.586L3.707 13.5z"/>
  </svg>`,
  // Chat-square-dots icon for comment/note
  comment: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chat-square-dots" viewBox="0 0 16 16">
    <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
    <path d="M5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
  </svg>`,
  // Filled chat icon for existing note
  commentFill: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chat-square-dots-fill" viewBox="0 0 16 16">
    <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.5a1 1 0 0 0-.8.4l-1.9 2.533a1 1 0 0 1-1.6 0L5.3 12.4a1 1 0 0 0-.8-.4H2a2 2 0 0 1-2-2zm5 4a1 1 0 1 0-2 0 1 1 0 0 0 2 0m4 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>
  </svg>`,
  // Eraser icon for delete
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eraser" viewBox="0 0 16 16">
  <path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828l6.879-6.879zm2.121.707a1 1 0 0 0-1.414 0L4.16 7.547l5.293 5.293 4.633-4.633a1 1 0 0 0 0-1.414l-3.879-3.879zM8.746 13.547 3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293l.16-.16z"/>
</svg>`,
  // Link icon (similar to bi-link)
  link: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-link-45deg" viewBox="0 0 16 16">
  <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z"/>
  <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z"/>
</svg>`,
  // Link small
  linkSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-link-45deg" viewBox="0 0 16 16">
  <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z"/>
  <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z"/>
</svg>`,
  // Crop icon for Clip
  camera: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-crop" viewBox="0 0 16 16">
  <path d="M3.5.5A.5.5 0 0 1 4 1v13h13a.5.5 0 0 1 0 1h-2v2a.5.5 0 0 1-1 0v-2H3.5a.5.5 0 0 1-.5-.5V4H1a.5.5 0 0 1 0-1h2V1a.5.5 0 0 1 .5-.5m2.5 3a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4H6.5a.5.5 0 0 1-.5-.5"/>
</svg>`,
  // Copy/Clipboard
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
</svg>`,
  // Target icon for Smart Capture
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" class="bi" viewBox="0 0 16 16">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25" d="M2 6V4a2 2 0 0 1 2-2h2M10 2h2a2 2 0 0 1 2 2v2M14 10v2a2 2 0 0 1-2 2h-2M6 14H4a2 2 0 0 1-2-2v-2" />
  <circle cx="8" cy="8" r="2" fill="currentColor" />
</svg>`,
  // Pin icons
  pin: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-pin-angle" viewBox="0 0 16 16">
  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146zm.122 2.112v-.002.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.83a.5.5 0 0 1-.707-.707l3.45-3.45a.5.5 0 0 1 .554-.032.546.546 0 0 1 .322.259zM8.743 7.464l3.465 3.465a.5.5 0 1 0 .708-.708L9.45 6.756A5.94 5.94 0 0 1 8.743 7.464z"/>
</svg>`,
  pinFill: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-pin-angle-fill" viewBox="0 0 16 16">
  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
</svg>`,
  check: `✓`,
};

export const COLOR_VALUES: Record<HighlightColor, string> = {
  yellow: 'rgb(253, 224, 71)',
  red: 'rgb(239, 68, 68)',
  blue: 'rgb(59, 130, 246)',
  green: 'rgb(34, 197, 94)'
};

export interface ToolboxState {
  selectedColor: HighlightColor;
  existingHighlight: Highlight | null;
  detectedLinks: Array<{ url: string; label: string }>;
  isLinkMenuOpen: boolean;
  highlightIdsInSelection: number[];
}

export class HighlightToolboxRenderer {

  escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  renderColorMode(
    container: HTMLDivElement,
    state: ToolboxState,
    isDarkMode: boolean
  ): void {
    container.className = `ext-lw-toolbox ${isDarkMode ? 'ext-lw-dark' : 'ext-lw-light'}`;

    const activeColor = state.selectedColor;

    // Build unified dock HTML
    let dockContent = '';

    // === COLOR SELECTOR (with dropdown) ===
    dockContent += `
      <div class="ext-lw-dock-color-wrapper" title="${i18n.t('highlightToolbox.changeColor')}">
        <div class="ext-lw-dock-color" style="background-color: ${COLOR_VALUES[activeColor]};" data-action="quick-color" data-color="${activeColor}"></div>
        <div class="ext-lw-void-dropdown-outer ext-lw-dock-color-dropdown-outer">
          <div class="ext-lw-void-dropdown ext-lw-dock-color-dropdown">
            ${HIGHLIGHT_COLORS.filter(c => c !== activeColor).map(color => `
              <button class="ext-lw-color-btn ext-lw-color-btn-${color}" data-color="${color}" style="background-color: ${COLOR_VALUES[color]};"></button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // === DIVIDER ===
    dockContent += '<div class="ext-lw-dock-divider"></div>';

    // === PRIMARY ACTIONS ===
    // Highlighter button (only for new selections)
    if (!state.existingHighlight) {
      dockContent += `
        <button class="ext-lw-dock-btn" data-action="highlight" title="${i18n.t('smartActions.highlight')}">
          ${ICONS.highlighter}
        </button>
      `;
    }

    // Note/Comment button
    dockContent += `
      <button class="ext-lw-dock-btn" data-action="comment" title="${state.existingHighlight?.comment ? i18n.t('highlightToolbox.editNote') : i18n.t('highlightToolbox.addNote')}">
        ${state.existingHighlight?.comment ? ICONS.commentFill : ICONS.comment}
      </button>
    `;

    // Clip or Copy button
    if (state.existingHighlight) {
      dockContent += `
        <button class="ext-lw-dock-btn" data-action="copy-text" title="${i18n.t('highlightToolbox.copyText')}">
          ${ICONS.copy}
        </button>
      `;
    } else {
      dockContent += `
        <button class="ext-lw-dock-btn" data-action="clip" title="${i18n.t('highlightToolbox.captureSelection')}">
          ${ICONS.camera}
        </button>
      `;
    }

    // Smart Capture
    dockContent += `
      <button class="ext-lw-dock-btn" data-action="smart-capture" title="${i18n.t('highlightToolbox.smartCapture')}">
        ${ICONS.target}
      </button>
    `;

    // === LINK SAVE (if links detected) ===
    let dropdownHtml = '';
    if (state.detectedLinks.length > 0) {
      dockContent += '<div class="ext-lw-dock-divider"></div>';

      const linkCount = state.detectedLinks.length;
      const hasMultiple = linkCount > 1;
      const badgeText = linkCount > 9 ? '9+' : String(linkCount);

      dockContent += `
        <div class="ext-lw-link-save-container">
          <button class="ext-lw-dock-btn" data-action="save-link" title="${i18n.t('highlightToolbox.saveLinks')}">
            ${ICONS.link}
            ${hasMultiple ? `<span class="ext-lw-link-badge">${badgeText}</span>` : ''}
          </button>
        </div>
      `;

      dropdownHtml = `
        <div class="ext-lw-void-dropdown-outer ext-lw-link-dropdown-outer ${state.isLinkMenuOpen ? '' : 'ext-lw-link-dropdown-hidden'}">
          <div class="ext-lw-void-dropdown ext-lw-link-dropdown">
            <div class="ext-lw-link-dropdown-header">${i18n.t('highlightToolbox.saveCount', { count: linkCount })}</div>
            <div class="ext-lw-link-dropdown-content">
              ${state.detectedLinks.map((link) => `
                <button class="ext-lw-link-item" data-url="${this.escapeHtml(link.url)}" title="${this.escapeHtml(link.url)}">
                  <span class="ext-lw-link-item-icon">${ICONS.linkSmall}</span>
                  <span class="ext-lw-link-url">${this.escapeHtml(link.label)}</span>
                </button>
              `).join('')}
            </div>
            ${hasMultiple ? `
              <button class="ext-lw-link-save-all" data-action="save-all-links">
                ${i18n.t('highlightToolbox.saveAll')}
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    // === DELETE (for existing highlights) ===
    if (state.existingHighlight || (state.highlightIdsInSelection && state.highlightIdsInSelection.length > 0)) {
      dockContent += '<div class="ext-lw-dock-divider"></div>';
      const isBulkDelete = !state.existingHighlight && state.highlightIdsInSelection && state.highlightIdsInSelection.length > 0;
      dockContent += `
        <button class="ext-lw-dock-btn" data-action="delete" title="${isBulkDelete ? i18n.t('highlightToolbox.deleteHighlights') : i18n.t('highlightToolbox.delete')}">
          ${ICONS.trash}
        </button>
      `;
    }

    // Wrap everything in two-layer structure: outer solid + inner glassmorphic
    // Dropdown is placed as a sibling to the dock-outer to allow adaptive width
    container.innerHTML = `
      <div class="ext-lw-void-dock-outer">
        <div class="ext-lw-void-dock">${dockContent}</div>
      </div>
      ${dropdownHtml}
    `;
  }


  renderCommentMode(
    container: HTMLDivElement,
    state: ToolboxState,
    commentValue: string,
    isPinned: boolean,
    isDarkMode: boolean,
    isAlreadyOpen: boolean
  ): void {
    const hideClass = isAlreadyOpen ? '' : 'ext-lw-note-panel-hidden';
    const newClassName = `ext-lw-toolbox ext-lw-note-panel ${hideClass} ${isDarkMode ? 'ext-lw-dark' : 'ext-lw-light'}`;

    container.className = newClassName;

    // IMPORTANT: Set opacity 0 BEFORE changing innerHTML so content change is invisible
    if (!isAlreadyOpen) {
      container.style.opacity = '0';
      container.style.visibility = 'visible';
    }

    // Generate color buttons
    const colorsHtml = HIGHLIGHT_COLORS.map(color => {
      const isActive = color === state.selectedColor;
      return `<button class="ext-lw-color-btn ext-lw-color-btn-${color} ${isActive ? 'ext-lw-color-btn-active' : ''}" data-note-color="${color}"></button>`;
    }).join('');

    container.innerHTML = `
      <div class="ext-lw-note-content">
        <textarea class="ext-lw-capture-note-textarea" placeholder="Add a note...">${commentValue}</textarea>
        <div class="ext-lw-capture-note-actions">
            <div class="ext-lw-note-color-picker">
                ${colorsHtml}
                <button class="ext-lw-pin-btn ${isPinned ? 'ext-lw-pinned' : ''}" data-action="toggle-pin" title="${isPinned ? 'Unpin panel' : 'Pin panel (prevent auto-close)'}">
                    ${isPinned ? ICONS.pinFill : ICONS.pin}
                </button>
            </div>
            <div class="ext-lw-note-buttons">
                <button class="ext-lw-btn ext-lw-btn-ghost" data-action="cancel-comment">Cancel</button>
                <button class="ext-lw-btn ext-lw-btn-primary" data-action="save-comment">Save</button>
            </div>
        </div>
      </div>
    `;
  }

  // Helper to update only changed elements in comment mode (prevents rewrite/flicker)
  updateCommentMode(
    container: HTMLDivElement,
    state: ToolboxState,
    isPinned: boolean,
    isDarkMode: boolean
  ): void {
    // Update Theme
    if (container.classList.contains('ext-lw-dark') !== isDarkMode) {
      container.classList.toggle('ext-lw-dark', isDarkMode);
      container.classList.toggle('ext-lw-light', !isDarkMode);
    }

    // Update Active Color Button
    container.querySelectorAll('.ext-lw-color-btn').forEach((btn) => {
      const color = (btn as HTMLElement).dataset.noteColor;
      if (color === state.selectedColor) {
        btn.classList.add('ext-lw-color-btn-active');
      } else {
        btn.classList.remove('ext-lw-color-btn-active');
      }
    });

    // Update Pin Button
    const pinBtn = container.querySelector('[data-action="toggle-pin"]');
    if (pinBtn) {
      if (isPinned) {
        pinBtn.classList.add('ext-lw-pinned');
        pinBtn.innerHTML = ICONS.pinFill;
        pinBtn.setAttribute('title', 'Unpin panel');
      } else {
        pinBtn.classList.remove('ext-lw-pinned');
        pinBtn.innerHTML = ICONS.pin;
        pinBtn.setAttribute('title', 'Pin panel (prevent auto-close)');
      }
    }
  }
}
