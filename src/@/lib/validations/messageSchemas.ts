import { z } from 'zod';

export const VerifySessionSchema = z.object({
    baseUrl: z.string().min(1),
    username: z.string().optional(),
    password: z.string().optional(),
    method: z.string().optional(),
    apiKey: z.string().optional(),
}).passthrough();

export const UpdateUserSchema = z.object({
    userId: z.number().int().positive(),
    data: z.record(z.unknown()),
});

export const UpdateLinkSchema = z.object({
    id: z.number().int().positive(),
    payload: z.record(z.unknown()),
});

export const DeleteLinkSchema = z.object({ id: z.number().int().positive() });
export const ArchiveLinkSchema = z.object({ id: z.number().int().positive(), action: z.enum(['archive', 'unarchive']) });
export const CheckLinkExistsSchema = z.object({ url: z.string().min(1) });
export const SaveLinkQuickSchema = z.object({ url: z.string().min(1), title: z.string().optional() });
export const SaveLinkFromExtensionSchema = z.object({ values: z.record(z.unknown()), aiTagged: z.boolean().optional() });
export const GetLinkWithHighlightsSchema = z.object({ url: z.string().min(1) });
export const LookupLinkIdSchema = z.object({ url: z.string().min(1) });

export const CreateHighlightSchema = z.object({
    linkId: z.number().int().optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    startOffset: z.number().optional(),
    endOffset: z.number().optional(),
}).passthrough();
export const DeleteHighlightSchema = z.object({ highlightId: z.number().int().positive(), linkId: z.number().int().positive() });
export const CreateFileHighlightSchema = z.object({ fileId: z.number().int().positive() }).passthrough();

export const FetchImageBlobSchema = z.object({ url: z.string().min(1) });
export const SaveImageSchema = z.object({
    url: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    pageContext: z.object({ pageUrl: z.string().optional(), pageTitle: z.string().optional() }).optional(),
}).passthrough();
export const UploadClipSchema = z.object({ dataUrl: z.string().min(1), filename: z.string().min(1), type: z.string().optional(), sourceUrl: z.string().optional(), sourceTitle: z.string().optional() });
export const DownloadDataUrlSchema = z.object({ dataUrl: z.string().min(1), filename: z.string().min(1), saveAs: z.boolean().optional() });

export const OpenTabSchema = z.object({ url: z.string().min(1) });

export const GetDomainPreferenceSchema = z.object({ domain: z.string().min(1) });
export const SetDomainPreferenceSchema = z.object({
    domain: z.string().min(1),
    enableSmartCapture: z.boolean().optional(),
    enableSelectionMenu: z.boolean().optional(),
}).refine((value) => typeof value.enableSmartCapture !== 'undefined' || typeof value.enableSelectionMenu !== 'undefined', { message: 'At least one domain preference field is required' });
export const SuggestTagsSchema = z.object({ url: z.string().url(), title: z.string().optional(), description: z.string().optional() });
export const BootstrapExtensionStateSchema = z.object({ domain: z.string().min(1).optional() }).passthrough();

export const SaveExtensionConfigSchema = z.object({
    baseUrl: z.string(),
    apiKey: z.string(),
    defaultCollection: z.string(),
    syncBookmarks: z.boolean(),
});
export const SaveExtensionPreferencesSchema = z.object({
    enableSmartCapture: z.boolean(),
    enableSelectionMenu: z.boolean(),
    showSavedMark: z.boolean(),
    showHighlights: z.boolean(),
    smartCaptureShortcut: z.record(z.unknown()),
    defaultHighlightColor: z.enum(['yellow', 'red', 'blue', 'green']),
    savePageOnHighlight: z.boolean(),
}).passthrough();
export const SaveSiteOverrideSchema = z.object({ hostname: z.string().min(1), key: z.enum(['enableSmartCapture', 'enableSelectionMenu']), value: z.boolean() });
export const ClearSiteOverrideSchema = z.object({ hostname: z.string().min(1), key: z.enum(['enableSmartCapture', 'enableSelectionMenu']) });
export const GetEffectivePreferencesSchema = z.object({ hostname: z.string().optional() }).passthrough();
export const SaveLocaleSettingsSchema = z.object({ localeSetting: z.enum(['en', 'tr', 'system']), locale: z.string().optional() });

export const MESSAGE_SCHEMAS: Record<string, z.ZodSchema> = {
    VERIFY_SESSION: VerifySessionSchema,
    UPDATE_USER: UpdateUserSchema,
    GET_LINK_WITH_HIGHLIGHTS: GetLinkWithHighlightsSchema,
    UPDATE_LINK: UpdateLinkSchema,
    DELETE_LINK: DeleteLinkSchema,
    ARCHIVE_LINK: ArchiveLinkSchema,
    CHECK_LINK_EXISTS: CheckLinkExistsSchema,
    LOOKUP_LINK_ID: LookupLinkIdSchema,
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
    GET_DOMAIN_PREFERENCE: GetDomainPreferenceSchema,
    SET_DOMAIN_PREFERENCE: SetDomainPreferenceSchema,
    SUGGEST_TAGS: SuggestTagsSchema,
    BOOTSTRAP_EXTENSION_STATE: BootstrapExtensionStateSchema,
    SAVE_EXTENSION_CONFIG: SaveExtensionConfigSchema,
    SAVE_EXTENSION_PREFERENCES: SaveExtensionPreferencesSchema,
    SAVE_SITE_OVERRIDE: SaveSiteOverrideSchema,
    CLEAR_SITE_OVERRIDE: ClearSiteOverrideSchema,
    GET_EFFECTIVE_PREFERENCES: GetEffectivePreferencesSchema,
    SAVE_LOCALE_SETTINGS: SaveLocaleSettingsSchema,
};
