// Smart Capture Mode Controller - Precision selection + Marquee multi-select
// Completely rewritten to use SelectableUnits, MarqueeSelection, and SelectionManager

import { SelectableUnits } from './SelectableUnits';
import { MarqueeSelection } from './MarqueeSelection';
import { SelectionManager } from './SelectionManager';
import { CaptureActionBar } from './CaptureActionBar';
import { ThemeDetector } from './ThemeDetector';
import { SmartCaptureCallbacks } from './types';
import { getEffectivePreferences, getHostname, ShortcutConfig, DEFAULT_PREFERENCES, ExtensionPreferences } from '../../../@/lib/settings';

/** Throttle interval for mousemove (ms) */
const MOUSEMOVE_THROTTLE = 16; // ~60fps

/** Minimum drag distance to start marquee (pixels) */
const MARQUEE_THRESHOLD = 8;

/**
 * SmartCaptureMode - Main controller for precision Smart Capture
 */
export class SmartCaptureMode {
    private selectableUnits: SelectableUnits;
    private marqueeSelection: MarqueeSelection;
    private selectionManager: SelectionManager;
    private actionBar: CaptureActionBar;
    private callbacks: SmartCaptureCallbacks;
    private themeDetector: ThemeDetector;
    private containerElement: Element | null = null;


    private isActive = false;
    private isPaused = false; // Pause overlay/cursor during NotePanel
    private isMarqueeMode = false;
    private dragStartPoint: { x: number; y: number } | null = null;
    private lastMousemoveTime = 0;
    private animationFrameId: number | null = null;
    private globalKeydownHandler: (e: KeyboardEvent) => void;
    private globalKeyupHandler: (e: KeyboardEvent) => void;
    private hintToast: HTMLDivElement | null = null;

    private shortcutConfig: ShortcutConfig = DEFAULT_PREFERENCES.smartCaptureShortcut;
    private enableSmartCapture = DEFAULT_PREFERENCES.enableSmartCapture;

    private boundHandlers: {
        mousemove: (e: MouseEvent) => void;
        mousedown: (e: MouseEvent) => void;
        mouseup: (e: MouseEvent) => void;
        click: (e: MouseEvent) => void;
        keydown: (e: KeyboardEvent) => void;
        scroll: () => void;
        wheel: (e: WheelEvent) => void;
        selectstart: (e: Event) => void;
    };

    constructor(callbacks: SmartCaptureCallbacks, containerSelector?: string) {
        this.callbacks = callbacks;
        this.selectableUnits = new SelectableUnits();

        // Set container scope if provided (for readable view constraint)
        if (containerSelector) {
            this.selectableUnits.setContainerSelector(containerSelector);
            this.containerElement = document.querySelector(containerSelector);


            // Find the actual scrolling container (parent with overflow-auto/scroll)
            if (this.containerElement) {


            }
        }

        this.marqueeSelection = new MarqueeSelection(this.selectableUnits);
        // Overlays use fixed positioning so they work in any context
        this.selectionManager = new SelectionManager(this.containerElement || undefined);
        // Action bar always appends to body for proper z-index in modal context
        this.actionBar = new CaptureActionBar();
        this.themeDetector = new ThemeDetector();

        // Bind handlers
        this.boundHandlers = {
            mousemove: this.handleMousemove.bind(this),
            mousedown: this.handleMousedown.bind(this),
            mouseup: this.handleMouseup.bind(this),
            click: this.handleClick.bind(this),
            keydown: this.handleKeydown.bind(this),
            scroll: this.handleScroll.bind(this),
            wheel: this.handleWheel.bind(this),
            selectstart: this.handleSelectStart.bind(this),
        };


        this.globalKeydownHandler = this.handleGlobalKeydown.bind(this);
        this.globalKeyupHandler = this.handleGlobalKeyup.bind(this);
        document.addEventListener('keydown', this.globalKeydownHandler);
        document.addEventListener('keyup', this.globalKeyupHandler);

        // Load initial preferences (with site-specific overrides)
        const hostname = getHostname(window.location.href);
        getEffectivePreferences(hostname).then(prefs => {
            if (prefs) {
                this.updateSettings(prefs);
            }
        });

        // Listen for preference changes (both global and site-specific)
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                // If either global prefs or site overrides changed, reload effective prefs
                if (changes.spark_preferences || changes.spark_site_overrides) {
                    const currentHostname = getHostname(window.location.href);
                    getEffectivePreferences(currentHostname).then(prefs => {
                        this.updateSettings(prefs);
                    });
                }
            }
        });


    }

    public updateSettings(prefs: ExtensionPreferences) {
        if (prefs.smartCaptureShortcut) {
            this.shortcutConfig = prefs.smartCaptureShortcut;
        }
        if (typeof prefs.enableSmartCapture !== 'undefined') {
            this.enableSmartCapture = prefs.enableSmartCapture;
            if (!this.enableSmartCapture && this.isActive) {
                this.deactivate();
            }
        }
    }

    public updateShortcut(config: ShortcutConfig) {
        this.shortcutConfig = config;
    }

    /**
     * Set or update the container selector for detection boundary
     */
    public setContainer(containerSelector: string | null): void {
        this.selectableUnits.setContainerSelector(containerSelector);
        if (containerSelector) {
            this.containerElement = document.querySelector(containerSelector);
        } else {
            this.containerElement = null;
        }
    }

    /**
     * Toggle Smart Capture mode
     */
    public toggle(): void {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    /**
     * Pause selection overlay and cursor (used during NotePanel)
     */
    public pauseSelection(): void {
        if (!this.isActive) return;
        this.isPaused = true;
        // Don't hide overlay, just stop updating it
        // Remove cursor class to restore normal cursor
        const targetElement = this.containerElement || document.body;
        targetElement.classList.remove('ext-lw-capture-mode-active');
    }

    /**
     * Resume selection overlay and cursor
     */
    public resumeSelection(): void {
        if (!this.isActive) return;
        this.isPaused = false;
        // Re-add cursor class
        const targetElement = this.containerElement || document.body;
        targetElement.classList.add('ext-lw-capture-mode-active');
        // Cursor will be restored on next mousemove
    }

    /**
     * Activate Smart Capture mode
     */
    public activate(): void {
        if (this.isActive) return;



        this.isActive = true;
        this.isMarqueeMode = false;
        this.dragStartPoint = null;

        // Recreate managers for fresh state (with container scoping)
        this.selectionManager = new SelectionManager(this.containerElement || undefined);
        this.marqueeSelection = new MarqueeSelection(this.selectableUnits);

        // Scan DOM for selectable units
        this.selectableUnits.scan(true);

        // Add cursor class to container (or body if no container)
        const targetElement = this.containerElement || document.body;
        targetElement.classList.add('ext-lw-capture-mode-active');

        // Apply theme class
        const isDark = this.themeDetector.isDarkMode();
        targetElement.classList.add(isDark ? 'ext-lw-dark' : 'ext-lw-light');

        // Attach event listeners
        document.addEventListener('mousemove', this.boundHandlers.mousemove, { passive: true, capture: true });
        document.addEventListener('mousedown', this.boundHandlers.mousedown, { capture: true });
        document.addEventListener('mouseup', this.boundHandlers.mouseup, { capture: true });
        document.addEventListener('click', this.boundHandlers.click, { capture: true });
        document.addEventListener('keydown', this.boundHandlers.keydown, { capture: true });
        document.addEventListener('selectstart', this.boundHandlers.selectstart, { capture: true });
        document.addEventListener('wheel', this.boundHandlers.wheel, { passive: false, capture: true });

        // Use document-level scroll listener with capture to catch ALL scroll events
        // This works for modals, iframes, and any nested scrolling containers

        document.addEventListener('scroll', this.boundHandlers.scroll, { passive: true, capture: true });

        // Show hint toast about Shift for multi-select
        this.showHintToast();


    }

    /**
     * Deactivate Smart Capture mode
     */
    public deactivate(): void {
        if (!this.isActive) return;



        this.isActive = false;
        this.isMarqueeMode = false;
        this.dragStartPoint = null;

        // Remove cursor class from container (or body if no container)
        const targetElement = this.containerElement || document.body;
        targetElement.classList.remove('ext-lw-capture-mode-active');
        targetElement.classList.remove('ext-lw-dark', 'ext-lw-light');

        // Remove event listeners
        document.removeEventListener('mousemove', this.boundHandlers.mousemove, { capture: true });
        document.removeEventListener('mousedown', this.boundHandlers.mousedown, { capture: true });
        document.removeEventListener('mouseup', this.boundHandlers.mouseup, { capture: true });
        document.removeEventListener('click', this.boundHandlers.click, { capture: true });
        document.removeEventListener('keydown', this.boundHandlers.keydown, { capture: true });
        document.removeEventListener('selectstart', this.boundHandlers.selectstart, { capture: true });
        document.removeEventListener('wheel', this.boundHandlers.wheel, { capture: true });
        document.removeEventListener('scroll', this.boundHandlers.scroll, { capture: true });

        // Cleanup
        this.hideHintToast();

        try {
            this.selectionManager.destroy();
        } catch (e) {

        }

        try {
            this.marqueeSelection.destroy();
        } catch (e) {

        }

        try {
            this.selectableUnits.clear();
        } catch (e) { /* ignore */ }

        try {
            this.actionBar.hide();
        } catch (e) {

        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Removed 'Smart Capture deactivated' toast as requested
    }

    /**
     * Check if mode is active
     */
    public isActiveMode(): boolean {
        return this.isActive;
    }

    /**
     * Handle global keyboard shortcut
     */
    private handleGlobalKeydown(e: KeyboardEvent): void {
        if (!this.enableSmartCapture) return;

        // Check if user is interacting with Linkwarden's own UI or inputs
        // OR if global shortcut recording is active
        if (document.body.classList.contains('ext-lw-recording-shortcut')) return;

        const path = e.composedPath();
        if (path.length > 0) {
            const target = path[0] as HTMLElement;
            // Check for inputs
            const tagName = target.tagName?.toUpperCase();
            if (
                tagName === 'INPUT' ||
                tagName === 'TEXTAREA' ||
                tagName === 'SELECT' ||
                target.isContentEditable
            ) {
                return;
            }

            // Check if inside Linkwarden UI components (Shadow Hosts)
            // Note: closest() does not cross Shadow Boundary, so we must check the path
            const isInsideUI = path.some(node => {
                const el = node as HTMLElement;
                return el.id === 'spark-embedded-host' ||
                    el.id === 'ext-lw-highlight-toolbox-host' ||
                    el.id === 'ext-lw-note-panel-host' ||
                    (el.classList && el.classList.contains('ext-lw-capture-actionbar'));
            });

            if (isInsideUI) return;
        }

        const { code, ctrlKey, shiftKey, altKey, metaKey, isModifierOnly } = this.shortcutConfig;

        // For modifier only shortcuts, we check modifiers directly
        // For standard shortcuts, we check code + modifiers

        let isMatch = false;

        if (isModifierOnly) {
            // Check if required modifiers are pressed
            // We assume ALL configured modifiers must be pressed
            const ctrlMatch = !ctrlKey || e.ctrlKey;
            const shiftMatch = !shiftKey || e.shiftKey;
            const altMatch = !altKey || e.altKey;
            const metaMatch = !metaKey || e.metaKey;

            // For modifier-only, at least one MUST be required, otherwise it's always active?
            // The config generator should ensure sensible config.

            isMatch = ctrlMatch && shiftMatch && altMatch && metaMatch;

            // Also need to ensure NO other major keys are pressed? 
            // Usually not strict.
        } else {
            // Exact match
            // If we have a stored 'key' (layout aware), prefer it over 'code'
            // This fixes issues with different keyboard layouts (e.g. Turkish)
            // If we have a stored 'key' (layout aware), prefer it over 'code'
            // This fixes issues with different keyboard layouts (e.g. Turkish)
            const keyMatch = this.shortcutConfig.key
                ? e.key.toLowerCase() === this.shortcutConfig.key.toLowerCase() ||
                e.key.toLocaleLowerCase('tr') === this.shortcutConfig.key.toLocaleLowerCase('tr')
                : e.code === code;

            isMatch = keyMatch &&
                e.ctrlKey === ctrlKey &&
                e.shiftKey === shiftKey &&
                e.altKey === altKey &&
                e.metaKey === metaKey;
        }

        if (isMatch) {
            e.preventDefault();
            e.stopPropagation();

            if (isModifierOnly) {
                // HOLD mode: Activate (if not already)
                if (!this.isActive) {
                    this.activate();
                }
            } else {
                // TOGGLE mode: Toggle
                this.toggle();
            }
        }
    }

    /**
     * Handle global key up for HOLD mode
     */
    private handleGlobalKeyup(e: KeyboardEvent): void {
        if (!this.enableSmartCapture || !this.isActive) return;

        // Check if recording shortcut
        if (document.body.classList.contains('ext-lw-recording-shortcut')) return;

        // Ignore if interacting with Linkwarden UI
        const path = e.composedPath();
        if (path.length > 0) {
            const isInsideUI = path.some(node => {
                const el = node as HTMLElement;
                return el.id === 'spark-embedded-host' ||
                    el.id === 'ext-lw-highlight-toolbox-host' ||
                    el.id === 'ext-lw-note-panel-host';
            });

            if (isInsideUI) return;
        }

        const { isModifierOnly, ctrlKey, shiftKey, altKey, metaKey } = this.shortcutConfig;

        if (isModifierOnly) {
            // If any REQUIRED modifier is released, deactivate
            // Check if the released key corresponds to a required modifier

            let releasedRequired = false;

            // Map key codes to modifiers roughly, or just check the event state
            // Better: Check if the required state is NO LONGER met?
            // e.ctrlKey reflects the state AFTER the event (usually).
            // Actually, on keyup `e.key` is the released key.
            // If I release Shift, e.shiftKey is false.

            if (ctrlKey && !e.ctrlKey) releasedRequired = true;
            if (shiftKey && !e.shiftKey) releasedRequired = true;
            if (altKey && !e.altKey) releasedRequired = true;
            if (metaKey && !e.metaKey) releasedRequired = true;

            if (releasedRequired) {
                this.deactivate();
            }
        }
    }

    /**
     * Prevent text selection in capture mode
     */
    private handleSelectStart(e: Event): void {
        if (this.isActive) {
            const target = e.target as HTMLElement;
            const isExcluded = target.closest('.ext-lw-capture-actionbar') ||
                target.closest('#ext-lw-capture-actionbar-host') ||
                target.closest('#spark-embedded-host') ||
                target.closest('#ext-lw-highlight-toolbox-host') ||
                target.closest('#ext-lw-note-panel-host') ||
                target.closest('.ext-lw-toolbox') ||
                target.closest('.ext-lw-toast');

            if (isExcluded) return;

            e.preventDefault();
            e.stopPropagation();
        }
    }

    /**
     * Handle mousedown - start potential marquee
     */
    private handleMousedown(e: MouseEvent): void {
        if (!this.isActive) return;

        const target = e.target as HTMLElement;
        const isExcluded = target.closest('.ext-lw-capture-actionbar') ||
            target.closest('#ext-lw-capture-actionbar-host') ||
            target.closest('#ext-lw-toast-notification-host') ||
            target.id === 'ext-lw-toast-notification-host' ||
            target.closest('#spark-embedded-host') ||
            target.closest('#ext-lw-highlight-toolbox-host') ||
            target.closest('#ext-lw-note-panel-host') ||
            target.closest('.ext-lw-toolbox') ||
            target.closest('.ext-lw-toast') ||
            target.closest('[data-radix-portal]') ||
            target.closest('[role="menu"]') ||
            target.closest('[role="dialog"]');



        if (isExcluded) return;

        // Check if selection change is allowed (e.g. if note panel has unsaved changes)
        if (this.callbacks.canSelectionChange && !this.callbacks.canSelectionChange()) {
            // Prevent interaction but allow clicking on the safe zones (checked above)
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Record start point for potential marquee
        this.dragStartPoint = { x: e.clientX, y: e.clientY };
    }

    /**
     * Handle mouseup - finish marquee or toggle selection
     */
    private handleMouseup(e: MouseEvent): void {
        if (!this.isActive) return;

        const target = e.target as HTMLElement;
        const isExcluded = target.closest('.ext-lw-capture-actionbar') ||
            target.closest('#ext-lw-capture-actionbar-host') ||
            target.closest('#ext-lw-toast-notification-host') ||
            target.id === 'ext-lw-toast-notification-host' ||
            target.closest('#spark-embedded-host') ||
            target.closest('#ext-lw-highlight-toolbox-host') ||
            target.closest('#ext-lw-note-panel-host') ||
            target.closest('.ext-lw-toolbox') ||
            target.closest('.ext-lw-toast') ||
            target.closest('[data-radix-portal]') ||
            target.closest('[role="menu"]') ||
            target.closest('[role="dialog"]');

        if (isExcluded) {

            return;
        }

        // If mousedown was blocked, we won't have dragStartPoint (unless logic flaw), but check anyway
        if (this.callbacks.canSelectionChange && !this.callbacks.canSelectionChange()) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        let selectionChanged = false;

        if (this.isMarqueeMode) {
            // Finish marquee selection
            const units = this.marqueeSelection.finish();

            if (units.length > 0) {
                // Apply selection based on modifiers
                if (e.shiftKey) {
                    this.selectionManager.addMultipleToSelection(units);
                } else if (e.altKey) {
                    this.selectionManager.removeMultipleFromSelection(units);
                } else {
                    this.selectionManager.setSelection(units);
                }

                // Show action bar if we have selections
                if (this.selectionManager.getSelectionCount() > 0) {
                    this.showActionBar();
                    selectionChanged = true;
                }
            }

            this.isMarqueeMode = false;
        } else if (this.dragStartPoint) {
            // It was a click (not a drag) - handle selection
            const hoveredUnit = this.selectionManager.getHoveredUnit();
            if (hoveredUnit) {
                if (e.shiftKey) {
                    // Shift+Click = toggle (add if not selected, remove if selected)
                    // This supports disjoint multi-selection (selecting A and C without B)
                    this.selectionManager.toggleSelection(hoveredUnit);
                    selectionChanged = true;
                } else {
                    // Default click (no modifier) = single selection
                    // Clear previous selection and select only this element
                    this.selectionManager.setSelection([hoveredUnit]);
                    selectionChanged = true;
                }

                // Show/hide action bar based on selection count
                if (this.selectionManager.getSelectionCount() > 0) {
                    this.showActionBar();
                } else {
                    this.actionBar.hide();
                }
            } else {
                // Clicked on empty space (no unit detected) -> should we clear selection?
                // Current logic does nothing if no hovered unit.
                // But user intent might be to "deselect".
                // However, original logic didn't clear explicitly here unless I missed it.
                // Let's assume if we clicked on valid unit, selection changed.
            }
        }

        this.dragStartPoint = null;

        // Notify contentScript about selection change
        if (selectionChanged && this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange();
        }
    }

    /**
     * Handle click - prevent default and browser navigation
     */
    private handleClick(e: MouseEvent): void {
        if (!this.isActive) return;

        const target = e.target as HTMLElement;
        const isExcluded = target.closest('.ext-lw-capture-actionbar') ||
            target.closest('#ext-lw-capture-actionbar-host') ||
            target.closest('#ext-lw-toast-notification-host') ||
            target.id === 'ext-lw-toast-notification-host' ||
            target.closest('#spark-embedded-host') ||
            target.closest('#ext-lw-highlight-toolbox-host') ||
            target.closest('#ext-lw-note-panel-host') ||
            target.closest('.ext-lw-toolbox') ||
            target.closest('.ext-lw-toast') ||
            target.closest('[data-radix-portal]') ||
            target.closest('[role="menu"]') ||
            target.closest('[role="dialog"]');

        if (isExcluded) {

            return;
        }

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Handle mousemove - hover detection + marquee update
     */
    private handleMousemove(e: MouseEvent): void {
        if (!this.isActive) return;

        // Throttle
        const now = performance.now();
        if (now - this.lastMousemoveTime < MOUSEMOVE_THROTTLE) return;
        this.lastMousemoveTime = now;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.animationFrameId = requestAnimationFrame(() => {
            this.processMousemove(e);
        });
    }

    /**
     * Process mousemove in animation frame
     */
    private processMousemove(e: MouseEvent): void {
        // If paused (e.g., NotePanel open), don't process mouse movements
        if (this.isPaused) return;

        // If hovering over action bar or note panel, don't update selection/hover
        const target = e.target as HTMLElement;
        if (target.closest('.ext-lw-capture-actionbar') ||
            target.closest('#ext-lw-capture-actionbar-host') ||
            target.closest('#ext-lw-toast-notification-host') ||
            target.id === 'ext-lw-toast-notification-host' ||
            target.closest('#ext-lw-note-panel-host') ||
            target.closest('#spark-embedded-host') ||
            target.closest('.ext-lw-toolbox') ||
            target.closest('.ext-lw-toast') ||
            target.closest('[data-radix-portal]') ||
            target.closest('[role="menu"]') ||
            target.closest('[role="dialog"]')) {
            // Explicitly hide hover when over excluded zones to prevent "stuck" overlays
            this.selectionManager.hideHover();
            return;
        }

        const x = e.clientX;
        const y = e.clientY;

        // Check if we should start marquee mode
        if (this.dragStartPoint && !this.isMarqueeMode) {
            const dx = Math.abs(x - this.dragStartPoint.x);
            const dy = Math.abs(y - this.dragStartPoint.y);

            if (dx > MARQUEE_THRESHOLD || dy > MARQUEE_THRESHOLD) {
                // Start marquee mode
                this.isMarqueeMode = true;
                this.marqueeSelection.start(this.dragStartPoint.x, this.dragStartPoint.y);
                this.selectionManager.hideHover();

            }
        }

        if (this.isMarqueeMode) {
            // Update marquee
            this.marqueeSelection.update(x, y);
        } else {
            // Normal hover detection using precision hit-test
            const unit = this.selectableUnits.findUnitAtPoint(x, y);
            this.selectionManager.setHovered(unit);
        }
    }

    /**
     * Handle keyboard events
     */
    private handleKeydown(e: KeyboardEvent): void {
        if (!this.isActive) return;

        // Escape
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();

            if (this.selectionManager.getSelectionCount() > 0) {
                // Clear selection first
                this.selectionManager.clearSelection();
                this.actionBar.hide();
            } else {
                // Deactivate mode
                this.deactivate();
            }
            return;
        }

        // Alt+Arrow for parent/child cycling (future enhancement)
        // For now, handled in wheel
    }

    /**
     * Handle wheel - Alt+Wheel for rescan (future: parent cycling)
     */
    /**
     * Handle wheel - Alt+Wheel for rescan (future: parent cycling)
     */
    private handleWheel(e: WheelEvent): void {
        if (!this.isActive) return;

        // On any wheel event, show the rescan hint
        this.updateHintDisplay(true);

        // Alt+Wheel to rescan units
        if (e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            this.selectableUnits.scan(true);

            // Show feedback in the hint box
            this.updateHintDisplay(true, true, this.selectableUnits.getUnits().length);
        }
    }

    /**
     * Handle scroll - refresh overlay positions and action bar
     */
    private handleScroll(): void {
        if (!this.isActive) return;



        // Refresh unit rects
        this.selectableUnits.refreshRects();


        this.selectionManager.refreshOverlays();


        // Update action bar position if visible
        if (this.actionBar.isCurrentlyVisible()) {

            this.actionBar.updatePosition();
        }
    }

    /**
     * Find the actual scrolling container by walking up the DOM tree
     */


    /**
     * Reshow action bar (public wrapper)
     */
    public reshowActionBar(): void {
        this.showActionBar();
    }

    /**
     * Show action bar for current selection
     */
    private showActionBar(): void {
        const target = this.selectionManager.createCaptureTarget();
        if (!target) return;

        // Create callbacks with context
        this.actionBar.show(target, {
            ...this.callbacks,
            onClose: () => {
                // Close button deactivates Smart Capture mode completely
                this.deactivate();
            },
        });
    }



    /**
     * Show hint toast about Shift for multi-select
     */
    /**
     * Show/Update persistent hint toast with stacked messages
     */
    private updateHintDisplay(showRescanHint: boolean = false, isRescannedFeedback: boolean = false, count: number = 0): void {
        const existing = document.querySelector('.ext-lw-hint-toast') as HTMLElement;
        const lang = navigator.language.toLowerCase();
        const isTr = lang.startsWith('tr');

        // Create container if not exists
        let container = existing;
        if (!container) {
            container = document.createElement('div');
            container.className = 'ext-lw-hint-toast';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.left = '20px';
            container.style.zIndex = '2147483647';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '8px';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);
            this.hintToast = container as HTMLDivElement;
        }

        // Shift Hint (Always active in Smart Capture)
        let shiftMsg = container.querySelector('.ext-lw-hint-shift') as HTMLElement;
        if (!shiftMsg) {
            const shiftText = isTr
                ? 'Seçime eklemek/çıkarmak için Shift basılı tutun'
                : 'Hold Shift to add/remove selections';

            shiftMsg = document.createElement('div');
            shiftMsg.className = 'ext-lw-hint-shift';
            shiftMsg.style.padding = '8px 12px';
            shiftMsg.style.background = 'rgba(0, 0, 0, 0.8)';
            shiftMsg.style.color = 'white';
            shiftMsg.style.borderRadius = '6px';
            shiftMsg.style.fontSize = '12px';
            shiftMsg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            shiftMsg.style.backdropFilter = 'blur(4px)';
            shiftMsg.textContent = shiftText;
            container.appendChild(shiftMsg);
        }

        // Rescan Hint (Conditional)
        let rescanMsg = container.querySelector('.ext-lw-hint-rescan') as HTMLElement;

        if (showRescanHint) {
            if (!rescanMsg) {
                rescanMsg = document.createElement('div');
                rescanMsg.className = 'ext-lw-hint-rescan';
                rescanMsg.style.padding = '8px 12px';
                rescanMsg.style.background = 'var(--lw-primary, #0f172a)'; // Use primary color or dark
                rescanMsg.style.color = 'white';
                rescanMsg.style.borderRadius = '6px';
                rescanMsg.style.fontSize = '12px';
                rescanMsg.style.fontWeight = '500';
                rescanMsg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
                rescanMsg.style.border = '1px solid rgba(255,255,255,0.1)';
                // Insert BEFORE shift message to stack on top (flex-direction is column)
                // Actually user said "add ONE MORE BOX above the shift message box". 
                // In flex-col, first child is top. So we insert/append depending on order.
                // If we want it ABOVE, it should be first child.
                container.insertBefore(rescanMsg, container.firstChild);
            }

            if (isRescannedFeedback) {
                const feedbackText = isTr
                    ? `Yeniden tarandı: ${count} öğe`
                    : `Rescanned: ${count} units`;
                rescanMsg.textContent = feedbackText;
                rescanMsg.style.background = '#22c55e'; // Success green

                // Revert back to hint after 2 seconds
                setTimeout(() => {
                    if (rescanMsg && document.body.contains(rescanMsg)) {
                        const hintText = isTr
                            ? 'Sayfa içeriği güncellendi, tekrar tarama için Alt+Wheel'
                            : 'Page content updated, use Alt+Wheel to rescan';
                        rescanMsg.textContent = hintText;
                        rescanMsg.style.background = 'var(--lw-primary, #0f172a)';
                    }
                }, 2000);
            } else {
                const hintText = isTr
                    ? 'Sayfa içeriği güncellendi, tekrar tarama için Alt+Wheel'
                    : 'Page content updated, use Alt+Wheel to rescan';

                // Only set if text is different (to avoid overwriting the feedback if it's showing)
                if (rescanMsg.textContent !== hintText && !rescanMsg.dataset.showingFeedback) {
                    rescanMsg.textContent = hintText;
                }
            }

            rescanMsg.style.display = 'block';

        } else if (rescanMsg) {
            rescanMsg.style.display = 'none';
        }
    }

    /**
     * Show hint toast about Shift for multi-select (Wrapper for init)
     */
    private showHintToast(): void {
        this.updateHintDisplay(false);
    }

    /**
     * Hide hint toast
     */
    private hideHintToast(): void {
        if (this.hintToast) {
            this.hintToast.remove();
            this.hintToast = null;
        }
    }

    /**
     * Destroy the Smart Capture mode
     */
    public destroy(): void {
        try {
            this.deactivate();
        } catch (e) {

        }

        try {
            if (this.actionBar) {
                this.actionBar.destroy();
            }
        } catch (e) {

        }

        try {
            document.removeEventListener('keydown', this.globalKeydownHandler);
            document.removeEventListener('keyup', this.globalKeyupHandler);
        } catch (e) { /* ignore */ }
    }
}
