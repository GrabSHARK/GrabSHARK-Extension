// Smart Capture Types - Core data structures for element detection and capture

/**
 * Target types that Smart Capture can detect
 */
export type CaptureTargetType =
    | 'TEXT_BLOCK'
    | 'LINK'
    | 'IMAGE'
    | 'VIDEO'
    | 'FILE'
    | 'GENERIC_BLOCK'
    | 'NONE';

/**
 * File extensions that indicate downloadable files
 */
export const FILE_EXTENSIONS = [
    // Documents
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'epub',
    // Archives
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    // Audio
    'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus',
    // Video
    'mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg',
    // Text/Data
    'txt', 'csv', 'json', 'xml', 'md', 'yaml', 'yml'
];

/**
 * Semantic tags that indicate text content blocks
 */
export const TEXT_BLOCK_TAGS = [
    'article', 'p', 'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'figcaption', 'caption'
];

/**
 * Tags that should be penalized in scoring (navigation elements)
 */
export const NAV_PENALTY_TAGS = [
    'nav', 'header', 'footer', 'aside', 'menu', 'menubar'
];

/**
 * Captured target information
 */
export interface CaptureTarget {
    /** Type of the detected element */
    type: CaptureTargetType;

    /** Secondary type for composite targets (e.g., IMAGE inside FILE link) */
    secondaryType?: CaptureTargetType;

    /** URL for LINK/FILE/IMAGE targets */
    url?: string;

    /** URL for secondary type (e.g., file link URL when primary is IMAGE) */
    secondaryUrl?: string;

    /** Title text (link text, image alt, block heading) */
    title?: string;

    /** Viewport-relative bounding rectangle */
    rect: DOMRect;

    /** Reference to DOM element (not persisted) */
    elementRef?: Element;

    /** Selectors for re-finding the element */
    selectors?: {
        cssPath?: string;
        xpath?: string;
        textQuote?: {
            exact: string;
            prefix?: string;
            suffix?: string;
        };
    };

    /** Extracted content from the element */
    extracted?: {
        /** Plain text content */
        text?: string;
        /** Sanitized HTML snippet */
        html?: string;
        /** Image information for IMAGE targets */
        image?: {
            src: string;
            currentSrc?: string;
            width?: number;
            height?: number;
        };
        /** Video information for VIDEO targets */
        video?: {
            src: string;
            currentSrc?: string;
            duration?: number;
            poster?: string;
        };
        /** All links found within the element */
        links?: Array<{ url: string; label: string }>;
        /** All images found within the element */
        images?: string[];
        /** All videos found within the element */
        videos?: string[];
        /** All downloadable files found within the element */
        files?: Array<{ url: string; label: string }>;
    };

    /** Page context at capture time */
    pageContext: {
        pageUrl: string;
        pageTitle: string;
        faviconUrl?: string;
        capturedAt: number;
    };

    /** For merged multi-block targets, references to individual targets */
    selectedTargets?: CaptureTarget[];
}

/**
 * Smart Capture mode state
 */
export interface SmartCaptureState {
    /** Whether Smart Capture mode is active */
    isActive: boolean;

    /** Whether a target is locked (clicked) */
    isLocked: boolean;

    /** Currently hovered target (before lock) */
    currentTarget: CaptureTarget | null;

    /** Locked target (after click) */
    lockedTarget: CaptureTarget | null;

    /** Whether user is dragging to select multiple blocks */
    isDragging: boolean;

    /** Starting point of drag selection */
    dragStartPoint: { x: number; y: number } | null;

    /** All targets selected during drag */
    selectedTargets: CaptureTarget[];
}

/**
 * Action types available in Smart Capture
 */
export type CaptureActionType =
    | 'highlight'
    | 'clip'
    | 'save_link'
    | 'save_image'
    | 'save_video'
    | 'save_file'
    | 'add_note';

/**
 * Actions available for each target type
 */
export const TARGET_ACTIONS: Record<CaptureTargetType, CaptureActionType[]> = {
    TEXT_BLOCK: ['highlight', 'clip', 'add_note'],
    LINK: ['highlight', 'clip', 'save_link', 'add_note'],
    IMAGE: ['clip', 'save_image', 'add_note'],
    VIDEO: ['clip', 'save_video', 'add_note'],
    FILE: ['clip', 'save_file', 'add_note'],
    GENERIC_BLOCK: ['highlight', 'clip', 'add_note'],
    NONE: []
};

/**
 * File type icons based on extension
 */
export const FILE_TYPE_ICONS: Record<string, string> = {
    // Audio
    mp3: '🎵', wav: '🎵', ogg: '🎵', flac: '🎵', aac: '🎵',
    // Video
    mp4: '🎬', avi: '🎬', mov: '🎬', mkv: '🎬', webm: '🎬',
    // Documents
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📽️', pptx: '📽️',
    // Archives
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
    // Data
    txt: '📃', csv: '📃', json: '📃', xml: '📃',
    // Default
    default: '📎'
};

/**
 * Get icon for file extension
 */
export function getFileTypeIcon(url: string): string {
    try {
        const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
        return ext ? (FILE_TYPE_ICONS[ext] || FILE_TYPE_ICONS.default) : FILE_TYPE_ICONS.default;
    } catch {
        return FILE_TYPE_ICONS.default;
    }
}

/**
 * File type labels for Save button
 */
const FILE_TYPE_LABELS: Record<string, string> = {
    // Audio
    mp3: 'Save Audio', wav: 'Save Audio', ogg: 'Save Audio', flac: 'Save Audio', aac: 'Save Audio',
    // Video
    mp4: 'Save Video', avi: 'Save Video', mov: 'Save Video', mkv: 'Save Video', webm: 'Save Video',
    // Documents
    pdf: 'Save PDF', doc: 'Save Document', docx: 'Save Document',
    xls: 'Save Spreadsheet', xlsx: 'Save Spreadsheet',
    ppt: 'Save Presentation', pptx: 'Save Presentation',
    // Archives
    zip: 'Save Archive', rar: 'Save Archive', '7z': 'Save Archive', tar: 'Save Archive', gz: 'Save Archive',
    // Data
    txt: 'Save Text', csv: 'Save Data', json: 'Save Data', xml: 'Save Data',
    // Default
    default: 'Save File'
};

/**
 * Get label for file type (Save Audio, Save Video, etc.)
 */
export function getFileTypeLabel(url: string): string {
    try {
        const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
        return ext ? (FILE_TYPE_LABELS[ext] || FILE_TYPE_LABELS.default) : FILE_TYPE_LABELS.default;
    } catch {
        return FILE_TYPE_LABELS.default;
    }
}

/**
 * Callbacks for Smart Capture mode
 */
export interface SmartCaptureCallbacks {
    onHighlight: (target: CaptureTarget) => Promise<void>;
    onClip: (target: CaptureTarget, thumbnail?: string) => Promise<void>;
    onSaveLink: (target: CaptureTarget) => Promise<void>;
    onSaveImage: (target: CaptureTarget) => Promise<void>;
    onSaveFile: (target: CaptureTarget) => Promise<void>;
    onSaveBatch?: (urls: string[], type: 'LINK' | 'IMAGE' | 'VIDEO' | 'FILE') => Promise<void>;
    onAddNote: (target: CaptureTarget) => Promise<void>;
    onBack?: (target: CaptureTarget) => void;  // Go back to selection mode (unlock target)
    onClose: () => void;
    canSelectionChange?: () => boolean; // Check if selection change is allowed (e.g. protected note panel)
    onSelectionChange?: () => void;     // Called when selection actually changes
}
