import { z } from 'zod';

// ========================
// Message Schemas for Background Script Runtime Validation
// Each schema validates the `message.data` payload for its corresponding message type.
// ========================

// --- Auth ---
export const VerifySessionSchema = z.object({
    baseUrl: z.string().min(1),
    username: z.string().optional(),
    password: z.string().optional(),
    method: z.string().optional(),
    apiKey: z.string().optional(),
}).passthrough();

// --- User ---
export const UpdateUserSchema = z.object({
    userId: z.number().int().positive(),
    data: z.record(z.unknown()),
});

// --- Links ---
export const GetLinkWithHighlightsSchema = z.object({
    url: z.string().min(1),
});

export const CreateLinkSchema = z.object({
    url: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    collection: z.object({
        id: z.number().optional(),
        name: z.string().optional(),
        ownerId: z.number().optional(),
    }).optional(),
    tags: z.array(z.object({ name: z.string() })).optional(),
}).passthrough();

export const UpdateLinkSchema = z.object({
    id: z.number().int().positive(),
    payload: z.record(z.unknown()),
});

export const DeleteLinkSchema = z.object({
    id: z.number().int().positive(),
});

export const ArchiveLinkSchema = z.object({
    id: z.number().int().positive(),
    action: z.enum(['archive', 'unarchive']),
});

export const CheckLinkExistsSchema = z.object({
    url: z.string().min(1),
});

export const SaveLinkQuickSchema = z.object({
    url: z.string().min(1),
    title: z.string().optional(),
});

export const SaveLinkFromExtensionSchema = z.object({
    values: z.record(z.unknown()),
    aiTagged: z.boolean().optional(),
});

// --- Highlights ---
export const CreateHighlightSchema = z.object({
    linkId: z.number().int().optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    startOffset: z.number().optional(),
    endOffset: z.number().optional(),
}).passthrough();

export const DeleteHighlightSchema = z.object({
    highlightId: z.number().int().positive(),
    linkId: z.number().int().positive(),
});

export const CreateFileHighlightSchema = z.object({
    fileId: z.number().int().positive(),
}).passthrough();

// --- Media ---
export const FetchImageBlobSchema = z.object({
    url: z.string().min(1),
});

export const SaveImageSchema = z.object({
    url: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    pageContext: z.object({
        pageUrl: z.string().optional(),
        pageTitle: z.string().optional(),
    }).optional(),
}).passthrough();

export const UploadClipSchema = z.object({
    dataUrl: z.string().min(1),
    filename: z.string().min(1),
    type: z.string().optional(),
    sourceUrl: z.string().optional(),
    sourceTitle: z.string().optional(),
});

export const DownloadDataUrlSchema = z.object({
    dataUrl: z.string().min(1),
    filename: z.string().min(1),
    saveAs: z.boolean().optional(),
});

export const OpenTabSchema = z.object({
    url: z.string().min(1),
});

export const GetDomainPreferenceSchema = z.object({
    domain: z.string().min(1),
});

// --- Mapping: message.type → schema for message.data ---
export const MESSAGE_SCHEMAS: Record<string, z.ZodSchema> = {
    VERIFY_SESSION: VerifySessionSchema,
    UPDATE_USER: UpdateUserSchema,
    GET_LINK_WITH_HIGHLIGHTS: GetLinkWithHighlightsSchema,
    CREATE_LINK: CreateLinkSchema,
    UPDATE_LINK: UpdateLinkSchema,
    DELETE_LINK: DeleteLinkSchema,
    ARCHIVE_LINK: ArchiveLinkSchema,
    CHECK_LINK_EXISTS: CheckLinkExistsSchema,
    SAVE_LINK_QUICK: SaveLinkQuickSchema,
    SAVE_LINK_FROM_EXTENSION: SaveLinkFromExtensionSchema,
    CREATE_HIGHLIGHT: CreateHighlightSchema,
    DELETE_HIGHLIGHT: DeleteHighlightSchema,
    CREATE_FILE_HIGHLIGHT: CreateFileHighlightSchema,
    FETCH_IMAGE_BLOB: FetchImageBlobSchema,
    SAVE_IMAGE: SaveImageSchema,
    UPLOAD_CLIP: UploadClipSchema,
    DOWNLOAD_DATA_URL: DownloadDataUrlSchema,
    OPEN_TAB: OpenTabSchema,
};
