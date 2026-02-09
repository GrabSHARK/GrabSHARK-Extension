// Floating Highlight Toolbox - Vanilla TS implementation
// Matches the ReadableView toolbox from main app

import { Highlight, HighlightColor } from '../../@/lib/types/highlight';
import { FeedbackIndicator } from './components/FeedbackIndicator';
import { ThemeManager } from './shared/ThemeManager';
import { HighlightToolboxRenderer, ToolboxState, ICONS } from './HighlightToolboxRenderer';


// Styles are now loaded via <link> from contentScript.css


export interface ToolboxCallbacks {
    onColorSelect: (color: HighlightColor) => Promise<void>;
    onCommentSave: (comment: string, color?: HighlightColor) => Promise<void>;
    onDelete: () => Promise<void>;
    onClip?: (selectionRect: DOMRect | null, selectionText: string) => void;
    onSmartCapture?: () => void;
    onSaveLink?: (url: string) => Promise<void>;
    onSaveAllLinks?: (urls: string[]) => Promise<void>;
    onCancelComment?: () => void;
    onOpenNotePanel?: (targetRect: DOMRect | null, selectedColor: HighlightColor) => void;
    onClose: () => void;
}

// ICONS and COLOR_VALUES moved to HighlightToolboxRenderer

export class HighlightToolbox {
    private container: HTMLDivElement | null = null;
    private host: HTMLDivElement | null = null;
    private shadow: ShadowRoot | null = null;
    private feedbackIndicator: FeedbackIndicator | null = null;
    private renderer: HighlightToolboxRenderer;

    // State matching Renderer interface (Data only)
    private state: ToolboxState = {
        selectedColor: 'yellow',
        existingHighlight: null,
        detectedLinks: [],
        highlightIdsInSelection: [],
        isLinkMenuOpen: false
    };

    // Internal Logic State (Control flags) - Renamed with _ to avoid collision with public methods
    private _isOpen: boolean = false;
    private _isCommentMode: boolean = false;

    private _position: { x: number; y: number } = { x: 0, y: 0 };
    private _targetRect?: DOMRect | null = null;

    private callbacks: ToolboxCallbacks | null = null;
    private commentValue: string = '';
    private originalCommentValue: string = ''; // Track original value to detect changes
    private isPinned: boolean = false; // Track if note panel is pinned (locked)
    // Drag state for note panel
    private isDragging: boolean = false;
    private hasManualPosition: boolean = false; // Track if position was manually set by drag
    private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;


    constructor() {
        this.renderer = new HighlightToolboxRenderer();
    }

    /**
     * Detect if the page is in dark mode
     * @deprecated Use ThemeManager.isDarkMode() directly for new code
     */
    private isDarkMode(): boolean {
        return ThemeManager.isDarkMode();
    }

    private ensureContainer(): void {
        if (this.container) return;

        // 1. Create Shadow Host
        this.host = document.createElement('div');
        this.host.id = 'ext-lw-highlight-toolbox-host';
        this.host.style.position = 'absolute';
        this.host.style.top = '0';
        this.host.style.left = '0';
        this.host.style.width = '0';
        this.host.style.height = '0';
        this.host.style.zIndex = '2147483647';
        this.host.style.pointerEvents = 'none';

        ['keydown', 'keyup', 'keypress'].forEach(eventType => {
            this.host!.addEventListener(eventType, (e) => {
                e.stopPropagation();
            });
        });

        document.body.appendChild(this.host);

        // 2. Attach Shadow DOM
        this.shadow = this.host.attachShadow({ mode: 'open' });

        // 3. Inject Styles (via Link)
        try {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('contentScript.css');
            this.shadow.appendChild(link);
        } catch (e) {

        }

        // 4. Create Container (inside Shadow)
        this.container = document.createElement('div');
        this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
        this.container.id = 'ext-lw-highlight-toolbox';
        this.container.style.pointerEvents = 'auto';

        // Prevent clearing text selection when interacting with toolbox (e.g. clicking color buttons)
        this.container.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            // Allow default behavior for inputs/textareas so they can be focused
            if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                return;
            }
            // Prevent focus stealing / selection clearing for buttons/divs
            e.preventDefault();
        });

        this.shadow.appendChild(this.container);

        // 5. Initialize FeedbackIndicator (inside same Shadow DOM)
        this.feedbackIndicator = new FeedbackIndicator(this.shadow);

        this.setupClickOutsideHandler();
    }

    private setupClickOutsideHandler(): void {
        this.clickOutsideHandler = (e: MouseEvent) => {
            if (!this._isOpen) return;

            // Don't close during drag operation
            if (this.isDragging) return;

            // Ignore right-click events to preserve text selection for context menu
            if (e.button === 2) {
                return;
            }

            const target = e.target as HTMLElement;

            // Check if click is inside our Shadow DOM using composedPath
            // This is the proper way to detect clicks inside Shadow DOM
            const path = e.composedPath();
            if (this.host && path.includes(this.host)) {

                return;
            }

            // Legacy fallback: In Shadow DOM, clicks inside the shadow root are retargeted to the host.
            // So if target === this.host, the click was inside the toolbox.
            if (target === this.host) {

                return;
            }

            // If clicking inside the toolbox container (direct check fallback), don't close
            if (this.container && this.container.contains(target)) {

                return;
            }

            // If dropdown is open, close it but keep toolbox open
            if (this.state.isLinkMenuOpen) {
                this.state.isLinkMenuOpen = false;
                const dropdownOuter = this.container?.querySelector('.ext-lw-link-dropdown-outer');
                if (dropdownOuter) {
                    dropdownOuter.classList.add('ext-lw-link-dropdown-hidden');
                }
                return;
            }

            // If in comment mode, prevent close entirely (user must use Cancel or Save buttons)
            if (this._isCommentMode) {

                return;
            }

            // If comment has unsaved changes (fallback check), prevent close
            if (this.isCommentDirty()) {

                return; // Block close - user must use Cancel or Save
            }

            // Otherwise close the whole toolbox

            this.close();
        };
        document.addEventListener('mousedown', this.clickOutsideHandler);
    }

    /**
     * Extract links from the current text selection
     */
    private extractLinksFromSelection(): Array<{ url: string; label: string }> {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return [];

        const linksMap = new Map<string, { url: string; label: string }>();

        // Get all ranges
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const container = range.commonAncestorContainer;

            // Find anchor tags within the selection
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(range.cloneContents());

            // Get all <a> tags
            tempDiv.querySelectorAll('a[href]').forEach((a) => {
                const anchor = a as HTMLAnchorElement;
                const href = anchor.href;
                if (href && (href.startsWith('http://') || href.startsWith('https://')) && !linksMap.has(href)) {
                    const label = anchor.textContent?.trim() || href.split('/').pop() || href;
                    linksMap.set(href, { url: href, label });
                }
            });

            // Also check if the selection is within an anchor tag
            let node: Node | null = container;
            while (node && node !== document.body) {
                if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
                    const anchor = node as HTMLAnchorElement;
                    const href = anchor.href;
                    if (href && (href.startsWith('http://') || href.startsWith('https://')) && !linksMap.has(href)) {
                        const label = anchor.textContent?.trim() || href.split('/').pop() || href;
                        linksMap.set(href, { url: href, label });
                    }
                }
                node = node.parentNode;
            }

            // Extract URLs from plain text using regex (no anchor text available)
            const text = range.toString();
            const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
            const matches = text.match(urlRegex);
            if (matches) {
                matches.forEach((url) => {
                    // Clean up trailing punctuation
                    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
                    if (!linksMap.has(cleanUrl)) {
                        // For regex-extracted URLs, use URL as label
                        linksMap.set(cleanUrl, { url: cleanUrl, label: cleanUrl });
                    }
                });
            }
        }

        return Array.from(linksMap.values());
    }

    public show(
        position: { x: number; y: number },
        callbacks: ToolboxCallbacks,
        existingHighlight?: Highlight | null,
        initialCommentMode: boolean = false,
        targetRect?: DOMRect, // Optional target rect for smart positioning
        providedLinks?: Array<{ url: string; label: string }>, // Optional pre-detected links (e.g., from Smart Capture target)
        highlightIdsInSelection?: number[], // Optional IDs of highlights within the selection (for bulk delete)
        defaultColor: HighlightColor = 'yellow' // Default highlight color from user preferences
    ): void {
        this.ensureContainer();
        if (!this.container) return; // Should not happen

        // Use provided links or extract from selection
        const detectedLinks = providedLinks ?? this.extractLinksFromSelection();

        // Update Internal State
        this._isOpen = true;
        this._isCommentMode = initialCommentMode;
        this._position = position;
        this._targetRect = targetRect || null;

        // Update Renderer State
        this.state = {
            existingHighlight: existingHighlight || null,
            detectedLinks,
            isLinkMenuOpen: false,
            selectedColor: existingHighlight?.color || defaultColor,
            highlightIdsInSelection: highlightIdsInSelection || []
        };

        this.callbacks = callbacks;
        this.commentValue = existingHighlight?.comment || '';
        this.originalCommentValue = this.commentValue;

        if (initialCommentMode) {
            this.isPinned = !!this.commentValue;
        } else {
            this.isPinned = false;
        }

        this.render();
    }


    public isOpen(): boolean {
        return this._isOpen;
    }

    public getCurrentHighlightId(): number | null {
        return this.state.existingHighlight?.id ?? null;
    }

    public isCommentMode(): boolean {
        return this._isCommentMode;
    }

    /**
     * Check if panel is currently being dragged
     */
    public isBeingDragged(): boolean {
        return this.isDragging;
    }

    /**
     * Check if comment has unsaved changes or is pinned
     */
    public isCommentDirty(): boolean {
        // Return true if pinned OR if there are actual changes
        return this._isCommentMode && (this.isPinned || this.commentValue !== this.originalCommentValue);
    }

    public close(): void {
        if (!this.container || !this._isOpen) return;

        // Add closing class to trigger exit animation
        if (this._isCommentMode) {
            // Note panel mode
            this.container.classList.add('ext-lw-closing');
        } else {
            // Color mode - target the outer dock container
            const outerDock = this.container.querySelector('.ext-lw-void-dock-outer');
            if (outerDock) {
                outerDock.classList.add('ext-lw-closing');
            } else {
                // Fallback for sub-tools if any
                this.container.classList.add('ext-lw-closing');
            }
        }

        // Wait for animation then actually close
        setTimeout(() => {
            this._isOpen = false;
            this._isCommentMode = false;
            this.hasManualPosition = false; // Reset manual position flag
            this.callbacks?.onClose();
            this.render();

            // Clear selection
            window.getSelection()?.removeAllRanges();
        }, 200); // Match animation duration
    }

    public setLoading(loading: boolean): void {
        if (loading) {
            // Hide main toolbox and show feedback indicator
            if (this.container) {
                this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
            }
            this.feedbackIndicator?.show({
                type: 'loading',
                position: this._position,
                darkMode: this.isDarkMode()
            });
        } else {
            this.feedbackIndicator?.hide();
            this.render();
        }
    }

    public setSuccess(): void {
        // Hide main toolbox and show success feedback
        if (this.container) {
            this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
        }

        this.feedbackIndicator?.show({
            type: 'success',
            position: this._position,
            darkMode: this.isDarkMode(),
            autoHideDuration: 800,
            onComplete: () => this.close()
        });
    }

    private render(): void {
        if (!this.container) return;

        if (!this._isOpen) {
            this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
            this.container.innerHTML = '';
            return;
        }

        // Position with viewport boundary checking
        this.positionWithinViewport();

        // Loading and success states are now handled by FeedbackIndicator
        // No need to render them here

        if (this._isCommentMode) {
            this.renderCommentMode();
        } else {
            this.renderColorMode();
        }
    }

    /**
     * Position the toolbox ensuring it stays within the viewport
     * 
     * Rules:
     * 1. Always center horizontally on the selection/highlight
     * 2. Keep entire toolbox within viewport (min 10px from edges)
     * 3. Priority: ABOVE selection (12px gap)
     * 4. Fallback: BELOW selection (12px gap)
     * 5. Last resort: CENTER on selection
     */
    private positionWithinViewport(): void {
        if (!this.container) return;

        const EDGE_PADDING = 10;  // Min distance from viewport edges
        const GAP = 12;           // Gap between selection and toolbox

        // Get actual dimensions (fallback for first render)
        const toolboxWidth = this.container.offsetWidth || 280;
        const toolboxHeight = this.container.offsetHeight || (this._isCommentMode ? 160 : 50);

        // Viewport dimensions (relative to current scroll)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        // Get target rect (selection or existing highlight)
        let targetRect: DOMRect | null = null;

        if (this._targetRect) {
            targetRect = this._targetRect;
        } else {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                try {
                    targetRect = selection.getRangeAt(0).getBoundingClientRect();
                } catch (e) {
                    // Selection might be invalid
                }
            }
        }

        // Fallback to initial position if no valid target
        if (!targetRect) {
            this.container.style.left = `${this._position.x}px`;
            this.container.style.top = `${this._position.y}px`;
            this.container.style.transform = 'translate(-50%, 0)';
            return;
        }

        // ========================================
        // HORIZONTAL POSITIONING (centered on target)
        // ========================================

        // Center X on target (in absolute/page coordinates)
        let x = targetRect.left + scrollX + (targetRect.width / 2);

        // Apply transform for centering
        this.container.style.transform = 'translate(-50%, 0)';

        // Calculate left/right edges after transform
        const leftEdge = x - (toolboxWidth / 2);
        const rightEdge = x + (toolboxWidth / 2);

        // Clamp to viewport (with 10px padding)
        if (leftEdge < scrollX + EDGE_PADDING) {
            x = scrollX + EDGE_PADDING + (toolboxWidth / 2);
        } else if (rightEdge > scrollX + viewportWidth - EDGE_PADDING) {
            x = scrollX + viewportWidth - EDGE_PADDING - (toolboxWidth / 2);
        }

        // ========================================
        // VERTICAL POSITIONING (above > below > center)
        // ========================================

        let y: number;

        // Check space ABOVE target (viewport-relative)
        const spaceAbove = targetRect.top - EDGE_PADDING;
        const fitsAbove = spaceAbove >= (toolboxHeight + GAP);

        // Check space BELOW target (viewport-relative)
        const spaceBelow = viewportHeight - targetRect.bottom - EDGE_PADDING;
        const fitsBelow = spaceBelow >= (toolboxHeight + GAP);

        if (fitsAbove) {
            // Position ABOVE (12px gap from top of selection)
            y = targetRect.top + scrollY - toolboxHeight - GAP;
        } else if (fitsBelow) {
            // Position BELOW (12px gap from bottom of selection)
            y = targetRect.bottom + scrollY + GAP;
        } else {
            // CENTER on the selection
            const selectionCenterY = targetRect.top + (targetRect.height / 2);
            y = selectionCenterY + scrollY - (toolboxHeight / 2);

            // Clamp to visible viewport
            const minY = scrollY + EDGE_PADDING;
            const maxY = scrollY + viewportHeight - toolboxHeight - EDGE_PADDING;
            y = Math.max(minY, Math.min(maxY, y));
        }

        // Apply final position
        this.container.style.left = `${x}px`;
        this.container.style.top = `${y}px`;
    }

    private renderColorMode(): void {
        if (!this.container) return;
        this.renderer.renderColorMode(this.container, this.state, this.isDarkMode());
        this.attachColorModeListeners();
    }

    // escapeHtml moved to Renderer

    private renderCommentMode(): void {
        if (!this.container) return;

        // Determine if we should hide initially (to prevent flash on first open)
        // If already in note mode and visible, don't hide (prevents blink on color change)
        const isAlreadyOpen = this.container.classList.contains('ext-lw-capture-actionbar-note-mode') && !this.container.classList.contains('ext-lw-note-panel-hidden');

        // OPTIMIZATION: Update via Renderer if already open
        if (isAlreadyOpen) {
            this.renderer.updateCommentMode(this.container, this.state, this.isPinned, this.isDarkMode());
            return;
        }

        this.renderer.renderCommentMode(
            this.container,
            this.state,
            this.commentValue,
            this.isPinned,
            this.isDarkMode(),
            isAlreadyOpen
        );

        this.attachCommentModeListeners();

        // After DOM change, recalculate position for new panel size (unless manually positioned), then show with animation
        requestAnimationFrame(() => {
            if (this.container) {
                // Only recalculate position if not manually dragged
                if (!this.hasManualPosition) {
                    this.positionWithinViewport();
                }

                // Now restore visibility and remove hidden class to trigger animation
                // Use setTimeout to let browser paint the invisible state first
                setTimeout(() => {
                    if (this.container) {
                        // Remove hidden class
                        this.container.classList.remove('ext-lw-note-panel-hidden');
                        // Set transition and animate
                        this.container.style.transition = 'opacity 0.5s ease-out';
                        this.container.style.opacity = '1';
                    }
                }, 50);
            }
        });

        // Focus textarea
        const textarea = this.container.querySelector('.ext-lw-capture-note-textarea') as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
            textarea.selectionStart = textarea.value.length;
        }
    }

    private attachColorModeListeners(): void {
        if (!this.container) return;

        // Quick Color (Left Box Trigger) - do nothing, dropdown is shown via CSS hover
        this.container.querySelector('[data-action="quick-color"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            // No action - just prevent click from bubbling
        });

        // Dropdown Colors
        this.container.querySelectorAll('.ext-lw-dock-color-dropdown .ext-lw-color-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const color = (btn as HTMLElement).dataset.color as HighlightColor;
                if (color && this.callbacks) {
                    this.setLoading(true);
                    try {
                        await this.callbacks.onColorSelect(color);
                        this.setSuccess();
                    } catch (error) {

                        this.setLoading(false);
                    }
                }
            });
        });

        // Comment button
        this.container.querySelector('[data-action="comment"]')?.addEventListener('click', (e) => {
            e.stopPropagation();


            if (this.callbacks?.onOpenNotePanel) {
                this.callbacks.onOpenNotePanel(
                    this._targetRect || this.container?.getBoundingClientRect() || null,
                    this.state.selectedColor
                );
                this.close();
            } else {
                this._isCommentMode = true;
                this.render();
            }
        });

        // Highlighter Button (Right Box)
        this.container.querySelector('[data-action="highlight"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            // Use the selected color from state (set from defaultColor or user's last pick)
            const color = this.state.selectedColor;
            if (this.callbacks) {
                this.setLoading(true);
                try {
                    await this.callbacks.onColorSelect(color);
                    this.setSuccess();
                } catch (error) {

                    this.setLoading(false);
                }
            }
        });


        // Delete button
        this.container.querySelector('[data-action="delete"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (this.callbacks) {
                this.setLoading(true);
                try {
                    await this.callbacks.onDelete();
                    this.setSuccess();
                } catch (error) {

                    this.setLoading(false);
                }
            }
        });

        // Clip button (capture selection as image) - only for new selections
        this.container.querySelector('[data-action="clip"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.callbacks?.onClip) {
                // Get selection rect BEFORE closing (close may clear selection)
                const selection = window.getSelection();
                let selectionRect: DOMRect | null = null;
                let selectionText = '';
                if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    selectionRect = range.getBoundingClientRect();
                    selectionText = selection.toString();
                }
                this.setLoading(true);
                this.callbacks.onClip(selectionRect, selectionText);
                // Show success after clip is triggered (clip is sync, runs immediately)
                this.setSuccess();
            }
        });

        // Copy text button (only for existing highlights)
        this.container.querySelector('[data-action="copy-text"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.state.existingHighlight?.text) {
                navigator.clipboard.writeText(this.state.existingHighlight.text).then(() => {
                    // Copied successfully (Process Indicator handles this)
                }).catch(() => {
                    showToast('Failed to copy', 'error');
                });
            }
        });

        // Smart Capture button
        this.container.querySelector('[data-action="smart-capture"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.callbacks?.onSmartCapture) {
                this.close();
                this.callbacks.onSmartCapture();
            }
        });

        // Link Save button
        this.container.querySelector('[data-action="save-link"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();


            // If single link, save directly
            if (this.state.detectedLinks.length === 1) {

                if (this.callbacks?.onSaveLink) {
                    this.setLoading(true);
                    try {
                        await this.callbacks.onSaveLink(this.state.detectedLinks[0].url);
                        this.setSuccess();
                    } catch (error) {
                        this.setLoading(false);
                    }
                }
            } else {
                // Multiple links - toggle dropdown visibility directly
                this.state.isLinkMenuOpen = !this.state.isLinkMenuOpen;

                const dropdownOuter = this.container?.querySelector('.ext-lw-link-dropdown-outer') as HTMLElement;

                if (dropdownOuter) {
                    dropdownOuter.classList.toggle('ext-lw-link-dropdown-hidden', !this.state.isLinkMenuOpen);

                    // Simple display toggle - respect universal VOID CSS for other properties
                    dropdownOuter.style.display = this.state.isLinkMenuOpen ? 'flex' : 'none';
                }
                // Toggle class on wrapper to prevent color dropdown from opening
                this.container?.classList.toggle('ext-lw-link-menu-open', this.state.isLinkMenuOpen);
            }
        });

        // Individual link items in dropdown
        this.container.querySelectorAll('.ext-lw-link-item').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const url = (btn as HTMLElement).dataset.url;
                if (url && this.callbacks?.onSaveLink) {
                    this.setLoading(true);
                    try {
                        await this.callbacks.onSaveLink(url);
                        this.setSuccess();
                    } catch (error) {
                        this.setLoading(false);
                    }
                }
            });
        });

        // Save all links button
        this.container.querySelector('[data-action="save-all-links"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (this.callbacks?.onSaveAllLinks && this.state.detectedLinks.length > 0) {
                this.setLoading(true);
                try {
                    await this.callbacks.onSaveAllLinks(this.state.detectedLinks.map(l => l.url));
                    this.setSuccess();
                } catch (error) {
                    this.setLoading(false);
                }
            }
        });
    }

    private attachCommentModeListeners(): void {
        if (!this.container) return;

        // Drag functionality for note panel
        // Mousedown on container to start drag (exclude textarea and interactive elements)
        let initialMouseX = 0;
        let initialMouseY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        const startDrag = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Don't drag if clicking on textarea, buttons, or inputs
            if (target.tagName === 'TEXTAREA' ||
                target.tagName === 'BUTTON' ||
                target.tagName === 'INPUT' ||
                target.closest('button') ||
                target.closest('textarea')) {
                return;
            }

            e.preventDefault();
            this.isDragging = true;

            // Store initial positions
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;

            // Get current computed position
            const rect = this.container!.getBoundingClientRect();
            const style = getComputedStyle(this.container!);

            // Parse current left/top values
            initialLeft = parseFloat(style.left) || rect.left;
            initialTop = parseFloat(style.top) || rect.top;

            this.container!.classList.add('ext-lw-dragging');

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('wheel', preventScroll, { passive: false });
        };

        const handleDrag = (e: MouseEvent) => {
            if (!this.isDragging || !this.container) return;
            e.preventDefault();

            // Calculate how much mouse has moved
            const deltaX = e.clientX - initialMouseX;
            const deltaY = e.clientY - initialMouseY;

            // Apply delta to initial position
            this.container.style.left = `${initialLeft + deltaX}px`;
            this.container.style.top = `${initialTop + deltaY}px`;
        };

        const preventScroll = (e: WheelEvent) => {
            if (this.isDragging) {
                e.preventDefault();
            }
        };

        const stopDrag = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container?.classList.remove('ext-lw-dragging');
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.removeEventListener('wheel', preventScroll);

                // Mark that position was manually set - skip repositioning on re-render
                this.hasManualPosition = true;
            }
        };

        this.container.addEventListener('mousedown', startDrag);

        // Color selection in note mode
        this.container.querySelectorAll('[data-note-color]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = (btn as HTMLElement).dataset.noteColor as HighlightColor;
                if (color) {
                    this.state.selectedColor = color;
                    // Re-render to show active state
                    this.renderCommentMode();

                    // Restore text value and focus
                    const textarea = this.container?.querySelector('.ext-lw-capture-note-textarea') as HTMLTextAreaElement;
                    if (textarea) {
                        textarea.value = this.commentValue;
                        textarea.focus();
                        textarea.selectionStart = textarea.value.length;
                    }
                }
            });
        });

        const textarea = this.container.querySelector('.ext-lw-capture-note-textarea') as HTMLTextAreaElement;

        textarea?.addEventListener('input', (e) => {
            this.commentValue = (e.target as HTMLTextAreaElement).value;
        });

        // Keyboard shortcuts
        textarea?.addEventListener('keydown', async (e) => {
            // ESC to cancel - only if no unsaved changes
            if (e.key === 'Escape') {
                e.stopPropagation();
                // If there are unsaved changes, block ESC close
                if (this.isCommentDirty()) {
                    return; // Block - user must use Cancel or Save
                }
                this._isCommentMode = false;
                this.commentValue = this.state.existingHighlight?.comment || '';
                this.render();
            }
            // Ctrl/Cmd + Enter to save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.stopPropagation();
                if (this.callbacks) {

                    this.setLoading(true);
                    try {
                        await this.callbacks.onCommentSave(this.commentValue, this.state.selectedColor);
                        this.setSuccess();
                    } catch (error) {

                        this.setLoading(false);
                    }
                }
            }
        });

        // Pin button
        this.container.querySelector('[data-action="toggle-pin"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isPinned = !this.isPinned;

            // Only update the pin button instead of full re-render to avoid animation flash
            const pinBtn = this.container?.querySelector('[data-action="toggle-pin"]') as HTMLButtonElement;
            if (pinBtn) {
                pinBtn.classList.toggle('ext-lw-pinned', this.isPinned);
                pinBtn.innerHTML = this.isPinned ? ICONS.pinFill : ICONS.pin;
                pinBtn.title = this.isPinned ? 'Unpin panel' : 'Pin panel (prevent auto-close)';
            }
        });

        // Cancel button
        this.container.querySelector('[data-action="cancel-comment"]')?.addEventListener('click', (e) => {
            e.stopPropagation();

            // If a specific cancel callback is provided (e.g. for Smart Capture to go back), use it
            if (this.callbacks?.onCancelComment) {

                this.callbacks.onCancelComment();
                return;
            }

            this.isPinned = false; // Reset pin on cancel
            this._isCommentMode = false;
            this.commentValue = this.state.existingHighlight?.comment || '';
            this.render();
        });

        // Save button
        this.container.querySelector('[data-action="save-comment"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (this.callbacks) {
                this.setLoading(true);
                try {
                    await this.callbacks.onCommentSave(this.commentValue, this.state.selectedColor);
                    this.setSuccess();
                } catch (error) {

                    this.setLoading(false);
                }
            }
        });
    }

    public destroy(): void {
        // Remove click outside handler
        if (this.clickOutsideHandler) {
            document.removeEventListener('mousedown', this.clickOutsideHandler);
            this.clickOutsideHandler = null;
        }

        // Clean up feedback indicator
        if (this.feedbackIndicator) {
            this.feedbackIndicator.hide();
            this.feedbackIndicator = null;
        }

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        if (this.host) {
            this.host.remove();
            this.host = null;
        }

        this.shadow = null;
    }
}

// Toast notification helper
export function showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const existing = document.querySelector('.ext-lw-toast');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = `ext-lw-toast ext-lw-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
