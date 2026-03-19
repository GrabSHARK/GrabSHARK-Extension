// Shared Note Panel Component
// Used by both HighlightToolbox (Selection Flow) and CaptureActionBar (Smart Capture Flow)

export interface NotePanelOptions {
    initialValue?: string;
    placeholder?: string;
    onSave: (note: string) => Promise<void>;
    onCancel: () => void;
    saveButtonText?: string;
}

/**
 * Shared Note Panel - provides consistent UI across Selection and Smart Capture flows
 * Uses the Smart Capture styling (lw-capture-note-*) for unified appearance
 */
export class NotePanel {
    private container: HTMLDivElement;
    private noteValue: string;
    private options: NotePanelOptions;
    private isSaving: boolean = false;

    constructor(parentContainer: HTMLElement, options: NotePanelOptions) {
        this.options = options;
        this.noteValue = options.initialValue || '';
        this.container = document.createElement('div');
        this.container.className = 'lw-note-panel';
        parentContainer.appendChild(this.container);
        this.render();
    }

    /**
     * Render the note panel
     */
    private render(): void {
        const placeholder = this.options.placeholder || 'Add a note...';
        const saveText = this.options.saveButtonText || 'Save Note';

        this.container.innerHTML = `
            <textarea class="lw-capture-note-textarea" placeholder="${placeholder}">${this.noteValue}</textarea>
            <div class="lw-capture-note-actions">
                <button class="lw-btn lw-btn-ghost" data-action="cancel-note" ${this.isSaving ? 'disabled' : ''}>Cancel</button>
                <button class="lw-btn lw-btn-primary" data-action="save-note" ${this.isSaving ? 'disabled' : ''}>${this.isSaving ? 'Saving...' : saveText}</button>
            </div>
        `;

        this.attachListeners();

        // Focus textarea
        const textarea = this.container.querySelector('.lw-capture-note-textarea') as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
            textarea.selectionStart = textarea.value.length;
        }
    }

    /**
     * Attach event listeners
     */
    private attachListeners(): void {
        const textarea = this.container.querySelector('.lw-capture-note-textarea') as HTMLTextAreaElement;

        // Track note value
        textarea?.addEventListener('input', (e) => {
            this.noteValue = (e.target as HTMLTextAreaElement).value;
        });

        // Cancel button
        this.container.querySelector('[data-action="cancel-note"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isSaving) {
                this.options.onCancel();
            }
        });

        // Save button
        this.container.querySelector('[data-action="save-note"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!this.isSaving) {
                await this.save();
            }
        });

        // Keyboard shortcuts
        textarea?.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape' && !this.isSaving) {
                e.stopPropagation();
                this.options.onCancel();
            }
            // Ctrl/Cmd + Enter to save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !this.isSaving) {
                e.stopPropagation();
                await this.save();
            }
        });
    }

    /**
     * Perform save action
     */
    private async save(): Promise<void> {
        this.isSaving = true;
        this.render();

        try {
            await this.options.onSave(this.noteValue);
        } finally {
            this.isSaving = false;
        }
    }

    /**
     * Get current note value
     */
    public getValue(): string {
        return this.noteValue;
    }

    /**
     * Destroy the panel
     */
    public destroy(): void {
        this.container.remove();
    }
}

/**
 * Create note panel HTML directly (for cases where class instance is not needed)
 * Returns HTML string and attach function
 */
export function createNotePanelHTML(options: {
    initialValue?: string;
    placeholder?: string;
    saveButtonText?: string;
}): string {
    const placeholder = options.placeholder || 'Add a note...';
    const saveText = options.saveButtonText || 'Save Note';
    const initialValue = options.initialValue || '';

    return `
        <textarea class="lw-capture-note-textarea" placeholder="${placeholder}">${initialValue}</textarea>
        <div class="lw-capture-note-actions">
            <button class="lw-btn lw-btn-ghost" data-action="cancel-note">Cancel</button>
            <button class="lw-btn lw-btn-primary" data-action="save-note">${saveText}</button>
        </div>
    `;
}
