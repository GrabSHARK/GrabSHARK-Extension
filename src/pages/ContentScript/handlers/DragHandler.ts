/**
 * DragHandler - Reusable drag & drop functionality for UI elements
 * 
 * Features:
 * - Start/stop drag on mousedown/mouseup
 * - Block dragging on interactive elements (textarea, button, input)
 * - Prevent scroll during drag
 * - Calculate position delta
 * - Add dragging class for visual feedback
 * 
 * Used by: HighlightToolbox (Note Panel mode)
 */

export interface DragHandlerOptions {
    /** Element to make draggable */
    element: HTMLElement;
    /** CSS class to add during drag (default: 'ext-lw-dragging') */
    draggingClass?: string;
    /** Callback when position changes during drag */
    onDrag?: (left: number, top: number) => void;
    /** Callback when drag ends */
    onDragEnd?: () => void;
}

export class DragHandler {
    private element: HTMLElement;
    private draggingClass: string;
    private onDrag?: (left: number, top: number) => void;
    private onDragEnd?: () => void;

    private isDragging: boolean = false;
    private initialMouseX: number = 0;
    private initialMouseY: number = 0;
    private initialLeft: number = 0;
    private initialTop: number = 0;

    private boundStartDrag: (e: MouseEvent) => void;
    private boundHandleDrag: (e: MouseEvent) => void;
    private boundStopDrag: () => void;
    private boundPreventScroll: (e: WheelEvent) => void;

    constructor(options: DragHandlerOptions) {
        this.element = options.element;
        this.draggingClass = options.draggingClass ?? 'ext-lw-dragging';
        this.onDrag = options.onDrag;
        this.onDragEnd = options.onDragEnd;

        this.boundStartDrag = this.startDrag.bind(this);
        this.boundHandleDrag = this.handleDrag.bind(this);
        this.boundStopDrag = this.stopDrag.bind(this);
        this.boundPreventScroll = this.preventScroll.bind(this);
    }

    /**
     * Enable drag functionality
     */
    public enable(): void {
        this.element.addEventListener('mousedown', this.boundStartDrag);
    }

    /**
     * Disable drag functionality
     */
    public disable(): void {
        this.element.removeEventListener('mousedown', this.boundStartDrag);
        this.stopDrag();
    }

    /**
     * Check if currently dragging
     */
    public isBeingDragged(): boolean {
        return this.isDragging;
    }

    /**
     * Cleanup all listeners
     */
    public destroy(): void {
        this.disable();
    }

    private startDrag(e: MouseEvent): void {
        const target = e.target as HTMLElement;

        // Don't drag if clicking on interactive elements
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
        this.initialMouseX = e.clientX;
        this.initialMouseY = e.clientY;

        // Get current computed position
        const rect = this.element.getBoundingClientRect();
        const style = getComputedStyle(this.element);

        // Parse current left/top values
        this.initialLeft = parseFloat(style.left) || rect.left;
        this.initialTop = parseFloat(style.top) || rect.top;

        this.element.classList.add(this.draggingClass);

        document.addEventListener('mousemove', this.boundHandleDrag);
        document.addEventListener('mouseup', this.boundStopDrag);
        document.addEventListener('wheel', this.boundPreventScroll, { passive: false });
    }

    private handleDrag(e: MouseEvent): void {
        if (!this.isDragging) return;
        e.preventDefault();

        // Calculate how much mouse has moved
        const deltaX = e.clientX - this.initialMouseX;
        const deltaY = e.clientY - this.initialMouseY;

        // Calculate new position
        const newLeft = this.initialLeft + deltaX;
        const newTop = this.initialTop + deltaY;

        // Apply position directly
        this.element.style.left = `${newLeft}px`;
        this.element.style.top = `${newTop}px`;

        // Call callback if provided
        this.onDrag?.(newLeft, newTop);
    }

    private preventScroll(e: WheelEvent): void {
        if (this.isDragging) {
            e.preventDefault();
        }
    }

    private stopDrag(): void {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.element.classList.remove(this.draggingClass);
        document.removeEventListener('mousemove', this.boundHandleDrag);
        document.removeEventListener('mouseup', this.boundStopDrag);
        document.removeEventListener('wheel', this.boundPreventScroll);

        // Call callback if provided
        this.onDragEnd?.();
    }
}
