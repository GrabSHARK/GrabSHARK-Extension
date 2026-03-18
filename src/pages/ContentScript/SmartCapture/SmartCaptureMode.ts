// Smart Capture Mode Controller - Precision selection + Marquee multi-select
import { SelectableUnits } from './SelectableUnits';
import { MarqueeSelection } from './MarqueeSelection';
import { SelectionManager } from './SelectionManager';
import { CaptureActionBar } from './CaptureActionBar';
import { ThemeDetector } from './ThemeDetector';
import { SmartCaptureCallbacks } from './types';
import { getEffectivePreferences, getHostname, ShortcutConfig, DEFAULT_PREFERENCES, ExtensionPreferences } from '../../../@/lib/settings';
import { isExcludedElement, isSelectStartExcluded, isInsideSparkUI, updateHintDisplay, hideHintToast } from './captureUIHelpers';

const MOUSEMOVE_THROTTLE = 16;
const MARQUEE_THRESHOLD = 8;

export class SmartCaptureMode {
    private selectableUnits: SelectableUnits;
    private marqueeSelection: MarqueeSelection;
    private selectionManager: SelectionManager;
    private actionBar: CaptureActionBar;
    private callbacks: SmartCaptureCallbacks;
    private themeDetector: ThemeDetector;
    private containerElement: Element | null = null;

    private isActive = false;
    private isPaused = false;
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

        if (containerSelector) {
            this.selectableUnits.setContainerSelector(containerSelector);
            this.containerElement = document.querySelector(containerSelector);
        }
        this.marqueeSelection = new MarqueeSelection(this.selectableUnits);
        this.selectionManager = new SelectionManager(this.containerElement || undefined);
        this.actionBar = new CaptureActionBar();
        this.themeDetector = new ThemeDetector();

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
        const hostname = getHostname(window.location.href);
        getEffectivePreferences(hostname).then(prefs => { if (prefs) this.updateSettings(prefs); });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.spark_preferences || changes.spark_site_overrides)) {
                getEffectivePreferences(getHostname(window.location.href)).then(prefs => this.updateSettings(prefs));
            }
        });
    }
    public updateSettings(prefs: ExtensionPreferences) {
        if (prefs.smartCaptureShortcut) this.shortcutConfig = prefs.smartCaptureShortcut;
        if (typeof prefs.enableSmartCapture !== 'undefined') {
            this.enableSmartCapture = prefs.enableSmartCapture;
            if (!this.enableSmartCapture && this.isActive) this.deactivate();
        }
    }

    public updateShortcut(config: ShortcutConfig) { this.shortcutConfig = config; }
    public setContainer(containerSelector: string | null): void {
        this.selectableUnits.setContainerSelector(containerSelector);
        this.containerElement = containerSelector ? document.querySelector(containerSelector) : null;
    }
    public toggle(): void { this.isActive ? this.deactivate() : this.activate(); }
    public pauseSelection(): void {
        if (!this.isActive) return;
        this.isPaused = true;
        (this.containerElement || document.body).classList.remove('ext-lw-capture-mode-active');
    }
    public resumeSelection(): void {
        if (!this.isActive) return;
        this.isPaused = false;
        (this.containerElement || document.body).classList.add('ext-lw-capture-mode-active');
    }
    public activate(): void {
        if (this.isActive) return;
        this.isActive = true;
        this.isMarqueeMode = false;
        this.dragStartPoint = null;

        this.selectionManager = new SelectionManager(this.containerElement || undefined);
        this.marqueeSelection = new MarqueeSelection(this.selectableUnits);
        this.selectableUnits.scan(true);

        const target = this.containerElement || document.body;
        target.classList.add('ext-lw-capture-mode-active');
        target.classList.add(this.themeDetector.isDarkMode() ? 'ext-lw-dark' : 'ext-lw-light');

        document.addEventListener('mousemove', this.boundHandlers.mousemove, { passive: true, capture: true });
        document.addEventListener('mousedown', this.boundHandlers.mousedown, { capture: true });
        document.addEventListener('mouseup', this.boundHandlers.mouseup, { capture: true });
        document.addEventListener('click', this.boundHandlers.click, { capture: true });
        document.addEventListener('keydown', this.boundHandlers.keydown, { capture: true });
        document.addEventListener('selectstart', this.boundHandlers.selectstart, { capture: true });
        document.addEventListener('wheel', this.boundHandlers.wheel, { passive: false, capture: true });
        document.addEventListener('scroll', this.boundHandlers.scroll, { passive: true, capture: true });

        this.hintToast = updateHintDisplay(this.hintToast, false);
    }
    public deactivate(): void {
        if (!this.isActive) return;
        this.isActive = false;
        this.isMarqueeMode = false;
        this.dragStartPoint = null;

        const target = this.containerElement || document.body;
        target.classList.remove('ext-lw-capture-mode-active', 'ext-lw-dark', 'ext-lw-light');

        document.removeEventListener('mousemove', this.boundHandlers.mousemove, { capture: true });
        document.removeEventListener('mousedown', this.boundHandlers.mousedown, { capture: true });
        document.removeEventListener('mouseup', this.boundHandlers.mouseup, { capture: true });
        document.removeEventListener('click', this.boundHandlers.click, { capture: true });
        document.removeEventListener('keydown', this.boundHandlers.keydown, { capture: true });
        document.removeEventListener('selectstart', this.boundHandlers.selectstart, { capture: true });
        document.removeEventListener('wheel', this.boundHandlers.wheel, { capture: true });
        document.removeEventListener('scroll', this.boundHandlers.scroll, { capture: true });

        this.hintToast = hideHintToast(this.hintToast);
        try { this.selectionManager.destroy(); } catch { }
        try { this.marqueeSelection.destroy(); } catch { }
        try { this.selectableUnits.clear(); } catch { }
        try { this.actionBar.hide(); } catch { }
        if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    }

    public isActiveMode(): boolean { return this.isActive; }
    private handleGlobalKeydown(e: KeyboardEvent): void {
        if (!this.enableSmartCapture) return;
        if (document.body.classList.contains('ext-lw-recording-shortcut')) return;
        if (isInsideSparkUI(e)) return;

        const { code, ctrlKey, shiftKey, altKey, metaKey, isModifierOnly } = this.shortcutConfig;
        let isMatch = false;

        if (isModifierOnly) {
            isMatch = (!ctrlKey || e.ctrlKey) && (!shiftKey || e.shiftKey) && (!altKey || e.altKey) && (!metaKey || e.metaKey);
        } else {
            const keyMatch = this.shortcutConfig.key
                ? e.key.toLowerCase() === this.shortcutConfig.key.toLowerCase() || e.key.toLocaleLowerCase('tr') === this.shortcutConfig.key.toLocaleLowerCase('tr')
                : e.code === code;
            isMatch = keyMatch && e.ctrlKey === ctrlKey && e.shiftKey === shiftKey && e.altKey === altKey && e.metaKey === metaKey;
        }

        if (isMatch) {
            e.preventDefault(); e.stopPropagation();
            isModifierOnly ? (!this.isActive && this.activate()) : this.toggle();
        }
    }
    private handleGlobalKeyup(e: KeyboardEvent): void {
        if (!this.enableSmartCapture || !this.isActive) return;
        if (document.body.classList.contains('ext-lw-recording-shortcut')) return;

        const path = e.composedPath();
        if (path.some(n => { const el = n as HTMLElement; return el.id === 'grabshark-embedded-host' || el.id === 'ext-lw-highlight-toolbox-host' || el.id === 'ext-lw-note-panel-host'; })) return;

        const { isModifierOnly, ctrlKey, shiftKey, altKey, metaKey } = this.shortcutConfig;
        if (isModifierOnly) {
            if ((ctrlKey && !e.ctrlKey) || (shiftKey && !e.shiftKey) || (altKey && !e.altKey) || (metaKey && !e.metaKey)) {
                this.deactivate();
            }
        }
    }
    private handleSelectStart(e: Event): void {
        if (this.isActive && !isSelectStartExcluded(e.target as HTMLElement)) {
            e.preventDefault(); e.stopPropagation();
        }
    }
    private handleMousedown(e: MouseEvent): void {
        if (!this.isActive || isExcludedElement(e.target as HTMLElement)) return;
        if (this.callbacks.canSelectionChange && !this.callbacks.canSelectionChange()) { e.preventDefault(); e.stopPropagation(); return; }
        e.preventDefault(); e.stopPropagation();
        this.dragStartPoint = { x: e.clientX, y: e.clientY };
    }
    private handleMouseup(e: MouseEvent): void {
        if (!this.isActive || isExcludedElement(e.target as HTMLElement)) return;
        if (this.callbacks.canSelectionChange && !this.callbacks.canSelectionChange()) return;
        e.preventDefault(); e.stopPropagation();

        let selectionChanged = false;
        if (this.isMarqueeMode) {
            const units = this.marqueeSelection.finish();
            if (units.length > 0) {
                if (e.shiftKey) this.selectionManager.addMultipleToSelection(units);
                else if (e.altKey) this.selectionManager.removeMultipleFromSelection(units);
                else this.selectionManager.setSelection(units);
                if (this.selectionManager.getSelectionCount() > 0) { this.showActionBar(); selectionChanged = true; }
            }
            this.isMarqueeMode = false;
        } else if (this.dragStartPoint) {
            const hoveredUnit = this.selectionManager.getHoveredUnit();
            if (hoveredUnit) {
                if (e.shiftKey) this.selectionManager.toggleSelection(hoveredUnit);
                else this.selectionManager.setSelection([hoveredUnit]);
                selectionChanged = true;
                this.selectionManager.getSelectionCount() > 0 ? this.showActionBar() : this.actionBar.hide();
            }
        }

        this.dragStartPoint = null;
        if (selectionChanged && this.callbacks.onSelectionChange) this.callbacks.onSelectionChange();
    }
    private handleClick(e: MouseEvent): void {
        if (!this.isActive || isExcludedElement(e.target as HTMLElement)) return;
        e.preventDefault(); e.stopPropagation();
    }
    private handleMousemove(e: MouseEvent): void {
        if (!this.isActive) return;
        const now = performance.now();
        if (now - this.lastMousemoveTime < MOUSEMOVE_THROTTLE) return;
        this.lastMousemoveTime = now;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = requestAnimationFrame(() => this.processMousemove(e));
    }
    private processMousemove(e: MouseEvent): void {
        if (this.isPaused) return;
        if (isExcludedElement(e.target as HTMLElement)) { this.selectionManager.hideHover(); return; }

        const { clientX: x, clientY: y } = e;

        if (this.dragStartPoint && !this.isMarqueeMode) {
            if (Math.abs(x - this.dragStartPoint.x) > MARQUEE_THRESHOLD || Math.abs(y - this.dragStartPoint.y) > MARQUEE_THRESHOLD) {
                this.isMarqueeMode = true;
                this.marqueeSelection.start(this.dragStartPoint.x, this.dragStartPoint.y);
                this.selectionManager.hideHover();
            }
        }

        this.isMarqueeMode ? this.marqueeSelection.update(x, y) : this.selectionManager.setHovered(this.selectableUnits.findUnitAtPoint(x, y));
    }
    private handleKeydown(e: KeyboardEvent): void {
        if (!this.isActive || e.key !== 'Escape') return;
        e.preventDefault(); e.stopPropagation();
        if (this.selectionManager.getSelectionCount() > 0) { this.selectionManager.clearSelection(); this.actionBar.hide(); }
        else this.deactivate();
    }
    private handleWheel(e: WheelEvent): void {
        if (!this.isActive) return;
        this.hintToast = updateHintDisplay(this.hintToast, true);
        if (e.altKey) {
            e.preventDefault(); e.stopPropagation();
            this.selectableUnits.scan(true);
            this.hintToast = updateHintDisplay(this.hintToast, true, true, this.selectableUnits.getUnits().length);
        }
    }
    private handleScroll(): void {
        if (!this.isActive) return;
        this.selectableUnits.refreshRects();
        this.selectionManager.refreshOverlays();
        if (this.actionBar.isCurrentlyVisible()) this.actionBar.updatePosition();
    }

    public reshowActionBar(): void { this.showActionBar(); }

    private showActionBar(): void {
        const target = this.selectionManager.createCaptureTarget();
        if (!target) return;
        this.actionBar.show(target, { ...this.callbacks, onClose: () => this.deactivate() });
    }

    public destroy(): void {
        try { this.deactivate(); } catch { }
        try { this.actionBar?.destroy(); } catch { }
        try { document.removeEventListener('keydown', this.globalKeydownHandler); document.removeEventListener('keyup', this.globalKeyupHandler); } catch { }
    }
}
