/**
 * Smart Capture UI Helpers
 * Extracted from SmartCaptureMode: hint toast display and excluded element checking
 */

/**
 * Check if an event target is in an excluded UI zone
 */
export function isExcludedElement(target: HTMLElement): boolean {
    return !!(
        target.closest('.ext-lw-capture-actionbar') ||
        target.closest('#ext-lw-capture-actionbar-host') ||
        target.closest('#ext-lw-toast-notification-host') ||
        target.id === 'ext-lw-toast-notification-host' ||
        target.closest('#grabshark-embedded-host') ||
        target.closest('#ext-lw-highlight-toolbox-host') ||
        target.closest('#ext-lw-note-panel-host') ||
        target.closest('.ext-lw-toolbox') ||
        target.closest('.ext-lw-toast') ||
        target.closest('[data-radix-portal]') ||
        target.closest('[role="menu"]') ||
        target.closest('[role="dialog"]')
    );
}

/**
 * Check if an event target is in a selectstart-excluded zone
 */
export function isSelectStartExcluded(target: HTMLElement): boolean {
    return !!(
        target.closest('.ext-lw-capture-actionbar') ||
        target.closest('#ext-lw-capture-actionbar-host') ||
        target.closest('#grabshark-embedded-host') ||
        target.closest('#ext-lw-highlight-toolbox-host') ||
        target.closest('#ext-lw-note-panel-host') ||
        target.closest('.ext-lw-toolbox') ||
        target.closest('.ext-lw-toast')
    );
}

/**
 * Check if a keyboard event is inside GrabSHARK UI
 */
export function isInsideGrabSHARKUI(e: KeyboardEvent | MouseEvent): boolean {
    const path = e.composedPath();
    if (path.length === 0) return false;

    const target = path[0] as HTMLElement;
    const tagName = target.tagName?.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) {
        return true;
    }

    return path.some(node => {
        const el = node as HTMLElement;
        return el.id === 'grabshark-embedded-host' ||
            el.id === 'ext-lw-highlight-toolbox-host' ||
            el.id === 'ext-lw-note-panel-host' ||
            (el.classList && el.classList.contains('ext-lw-capture-actionbar'));
    });
}

/**
 * Create or update the hint toast display
 */
export function updateHintDisplay(
    _hintToast: HTMLDivElement | null,
    showRescanHint: boolean = false,
    isRescannedFeedback: boolean = false,
    count: number = 0
): HTMLDivElement | null {
    const existing = document.querySelector('.ext-lw-hint-toast') as HTMLElement;
    const lang = navigator.language.toLowerCase();
    const isTr = lang.startsWith('tr');

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
    }

    // Shift Hint
    let shiftMsg = container.querySelector('.ext-lw-hint-shift') as HTMLElement;
    if (!shiftMsg) {
        const shiftText = isTr ? 'Seçime eklemek/çıkarmak için Shift basılı tutun' : 'Hold Shift to add/remove selections';
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

    // Rescan Hint
    let rescanMsg = container.querySelector('.ext-lw-hint-rescan') as HTMLElement;

    if (showRescanHint) {
        if (!rescanMsg) {
            rescanMsg = document.createElement('div');
            rescanMsg.className = 'ext-lw-hint-rescan';
            rescanMsg.style.padding = '8px 12px';
            rescanMsg.style.background = 'var(--lw-primary, #0f172a)';
            rescanMsg.style.color = 'white';
            rescanMsg.style.borderRadius = '6px';
            rescanMsg.style.fontSize = '12px';
            rescanMsg.style.fontWeight = '500';
            rescanMsg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
            rescanMsg.style.border = '1px solid rgba(255,255,255,0.1)';
            container.insertBefore(rescanMsg, container.firstChild);
        }

        if (isRescannedFeedback) {
            const feedbackText = isTr ? `Yeniden tarandı: ${count} öğe` : `Rescanned: ${count} units`;
            rescanMsg.textContent = feedbackText;
            rescanMsg.style.background = '#22c55e';
            setTimeout(() => {
                if (rescanMsg && document.body.contains(rescanMsg)) {
                    const hintText = isTr ? 'Sayfa içeriği güncellendi, tekrar tarama için Alt+Wheel' : 'Page content updated, use Alt+Wheel to rescan';
                    rescanMsg.textContent = hintText;
                    rescanMsg.style.background = 'var(--lw-primary, #0f172a)';
                }
            }, 2000);
        } else {
            const hintText = isTr ? 'Sayfa içeriği güncellendi, tekrar tarama için Alt+Wheel' : 'Page content updated, use Alt+Wheel to rescan';
            if (rescanMsg.textContent !== hintText && !rescanMsg.dataset.showingFeedback) {
                rescanMsg.textContent = hintText;
            }
        }
        rescanMsg.style.display = 'block';
    } else if (rescanMsg) {
        rescanMsg.style.display = 'none';
    }

    return container as HTMLDivElement;
}

/**
 * Hide and remove hint toast
 */
export function hideHintToast(hintToast: HTMLDivElement | null): null {
    if (hintToast) {
        hintToast.remove();
    }
    return null;
}
