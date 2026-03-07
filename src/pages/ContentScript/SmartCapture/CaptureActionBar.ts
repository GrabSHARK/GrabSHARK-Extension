/**
 * Capture Action Bar - Unified action menu for Smart Capture
 * Uses React CaptureDock component rendered in Shadow DOM
 * 
 * Delegates positioning to viewportLayout.ts
 */

import { CaptureTarget, SmartCaptureCallbacks } from './types';
import { ThemeDetector } from './ThemeDetector';
import { loadReactModule, type SparkReactModule } from '../utils/reactLoader';
import { positionFloatingBar } from './viewportLayout';

type Root = import('react-dom/client').Root;

export class CaptureActionBar {
    private container: HTMLDivElement | null = null;
    private host: HTMLDivElement | null = null;
    private shadow: ShadowRoot | null = null;
    private isVisible = false;
    private currentTarget: CaptureTarget | null = null;
    private callbacks: SmartCaptureCallbacks | null = null;
    private themeQuery: MediaQueryList | null = null;
    private handleThemeChange: (e: MediaQueryListEvent) => void;
    private themeDetector: ThemeDetector;
    private containerElement: Element;
    private resizeObserver: ResizeObserver | null = null;
    private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
    private reactRoot: Root | null = null;
    private reactModule: SparkReactModule | null = null;

    constructor(containerElement?: Element) {
        this.containerElement = containerElement || document.body;
        this.themeDetector = new ThemeDetector();
        this.handleThemeChange = () => this.updateTheme();
    }

    private async ensureContainer(): Promise<void> {
        if (this.container) return;

        if (!this.reactModule) this.reactModule = await loadReactModule();

        this.host = document.createElement('div');
        this.host.id = 'ext-lw-capture-actionbar-host';
        this.host.style.position = 'fixed';
        this.host.style.top = '0';
        this.host.style.left = '0';
        this.host.style.width = 'max-content';
        this.host.style.height = 'max-content';
        this.host.style.display = 'block';
        this.host.style.zIndex = '2147483647';
        this.host.style.pointerEvents = 'auto';

        ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu', 'wheel'].forEach(evt => {
            this.host!.addEventListener(evt, (e) => e.stopPropagation());
        });

        this.containerElement.appendChild(this.host);
        this.shadow = this.host.attachShadow({ mode: 'open' });

        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('contentScript.css');
        this.shadow.appendChild(styleLink);

        this.container = document.createElement('div');
        this.container.className = 'ext-lw-capture-actionbar-outer ext-lw-capture-actionbar-hidden';
        this.container.style.pointerEvents = 'auto';
        this.container.style.setProperty('position', 'relative', 'important');
        this.shadow.appendChild(this.container);

        styleLink.onload = () => {
            if (this.isVisible && this.currentTarget && this.host && this.container) {
                positionFloatingBar(this.host, this.container, this.currentTarget);
            }
        };

        ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'contextmenu', 'wheel'].forEach(evt => {
            this.container?.addEventListener(evt, (e) => e.stopPropagation());
        });

        this.setupClickOutsideHandler();
        this.setupThemeListener();
        this.setupResizeObserver();
    }

    private setupResizeObserver(): void {
        if (this.resizeObserver || !this.container) return;
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isVisible && this.currentTarget && this.host && this.container) {
                positionFloatingBar(this.host, this.container, this.currentTarget);
            }
        });
        this.resizeObserver.observe(this.container);
    }

    private setupClickOutsideHandler(): void {
        this.clickOutsideHandler = (e: MouseEvent) => {
            if (!this.isVisible) return;
            const target = e.target as HTMLElement;
            if (target === this.host) return;
            if (this.container && this.container.contains(target)) return;
            if (target.closest('.ext-lw-capture-overlay')) return;
            this.callbacks?.onClose ? this.callbacks.onClose() : this.hide();
        };
        document.addEventListener('mousedown', this.clickOutsideHandler);
    }

    private setupThemeListener(): void {
        this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.updateTheme();
        if (this.themeQuery.addEventListener) {
            this.themeQuery.addEventListener('change', this.handleThemeChange);
        } else {
            this.themeQuery.addListener(this.handleThemeChange);
        }
    }

    private updateTheme(): void {
        if (!this.container) return;
        const isDark = this.themeDetector.isDarkMode();
        this.container.classList.toggle('ext-lw-dark', isDark);
        this.container.classList.toggle('ext-lw-light', !isDark);
    }

    public async show(target: CaptureTarget, callbacks: SmartCaptureCallbacks): Promise<void> {
        if (target.type === 'NONE') return;
        await this.ensureContainer();
        if (!this.container || !this.host) return;

        const wasVisible = this.isVisible;
        this.currentTarget = target;
        this.callbacks = callbacks;
        this.isVisible = true;

        if (!this.reactRoot && this.container && this.reactModule) {
            this.reactRoot = this.reactModule.createRoot(this.container);
        }

        this.render();

        if (wasVisible) {
            this.host.style.setProperty('transition', 'top 0.2s cubic-bezier(0.2, 0, 0.2, 1), left 0.2s cubic-bezier(0.2, 0, 0.2, 1)', 'important');
            positionFloatingBar(this.host, this.container, target);
            this.updateTheme();
        } else {
            this.host.style.setProperty('transition', 'none', 'important');
            this.container.classList.remove('ext-lw-capture-actionbar-hidden', 'ext-lw-closing');
            this.container.style.setProperty('display', 'flex', 'important');
            this.container.style.setProperty('visibility', 'visible', 'important');
            this.container.style.opacity = '';
            this.container.style.transform = '';
            this.container.style.transition = '';
            this.container.style.animation = '';
            positionFloatingBar(this.host, this.container, target);
            this.updateTheme();
        }
    }

    public hide(): void {
        if (!this.container || !this.isVisible) return;
        this.isVisible = false;
        this.currentTarget = null;

        this.container.style.opacity = '';
        this.container.style.transform = '';
        this.container.style.transition = '';
        this.container.classList.add('ext-lw-closing');

        setTimeout(() => {
            if (!this.container) return;
            this.container.classList.add('ext-lw-capture-actionbar-hidden');
            this.container.classList.remove('ext-lw-closing');
            this.container.style.setProperty('display', 'none', 'important');
            this.container.style.setProperty('visibility', 'hidden', 'important');
        }, 200);
    }

    public isShowing(): boolean { return this.isVisible; }

    private render(): void {
        if (!this.container || !this.currentTarget || !this.callbacks) return;
        if (!this.reactRoot && this.container && this.reactModule) {
            this.reactRoot = this.reactModule.createRoot(this.container);
        }
        if (this.reactRoot && this.reactModule) {
            this.reactRoot.render(
                this.reactModule.React.createElement(this.reactModule.CaptureDock, {
                    target: this.currentTarget,
                    isDark: this.themeDetector.isDarkMode(),
                    callbacks: this.callbacks,
                    faviconUrl: chrome.runtime.getURL('16.png'),
                })
            );
        }
    }

    public destroy(): void {
        if (this.clickOutsideHandler) { document.removeEventListener('mousedown', this.clickOutsideHandler); this.clickOutsideHandler = null; }
        if (this.themeQuery) {
            if (this.themeQuery.removeEventListener) this.themeQuery.removeEventListener('change', this.handleThemeChange);
            else this.themeQuery.removeListener(this.handleThemeChange);
            this.themeQuery = null;
        }
        if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
        if (this.host) { this.host.remove(); this.host = null; }
        if (this.container) {
            if (this.reactRoot) { this.reactRoot.unmount(); this.reactRoot = null; }
            this.container.remove(); this.container = null;
        }
    }

    public isCurrentlyVisible(): boolean { return this.isVisible; }

    public updatePosition(): void {
        if (!this.isVisible || !this.currentTarget || !this.host || !this.container) return;
        positionFloatingBar(this.host, this.container, this.currentTarget);
    }
}
