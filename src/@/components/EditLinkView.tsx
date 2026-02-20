import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Toaster } from './ui/Toaster';
import { toast } from '../../hooks/use-toast';
import { getThumbnail } from '../lib/thumbnailCache';
import { LinkWithHighlights } from '../lib/types/highlight';
import { getConfig } from '../lib/config';
import { getCurrentUser } from '../lib/actions/users';

import { LinkHeader } from './EditLink/LinkHeader';
import { LinkPreviewCard } from './EditLink/LinkPreviewCard';
import { EditLinkForm } from './EditLink/EditLinkForm';
import { LinkFooter } from './EditLink/LinkFooter';
import { DeleteDialog } from './EditLink/DeleteDialog';

// Validation schema similar to bookmarkForm but for editing
const editLinkFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    collection: z.object({
        id: z.number().optional(),
        name: z.string(),
        ownerId: z.number().optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
    }),
    tags: z.array(
        z.object({
            id: z.number().optional(),
            name: z.string(),
        })
    ).optional(),
});

type EditLinkFormValues = z.infer<typeof editLinkFormSchema>;

interface EditLinkViewProps {
    link: LinkWithHighlights;
    onClose: () => void;
    onBack?: () => void;
    containerRef?: HTMLElement | null;
    onUpdate?: (updatedLink: Partial<LinkWithHighlights>) => void;
    sharedImgSrc?: string;
    onImgSrcChange?: (src: string) => void;
    onDelete?: () => void;
}

export const EditLinkView = ({ link: rawLink, onClose, onBack, containerRef, onUpdate, sharedImgSrc, onImgSrcChange, onDelete }: EditLinkViewProps) => {
    // Normalize incoming data - handle {response: {...}} wrapper from API
    const link = (rawLink as any)?.response || rawLink;

    const { t } = useTranslation();
    const [openCollections, setOpenCollections] = useState(false);
    const [openTags, setOpenTags] = useState(false);
    const ignoreNextOpenChange = useRef(false);

    const handleToggleCollections = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!openCollections) {
            setOpenTags(false);
        }

        ignoreNextOpenChange.current = true;
        setOpenCollections((prev) => !prev);
        setTimeout(() => {
            ignoreNextOpenChange.current = false;
        }, 100);
    };

    // @ts-ignore
    const [isPinned, setIsPinned] = useState(() => {
        // Robust check for pinned state
        if (Array.isArray(link.pinnedBy)) {
            return link.pinnedBy.length > 0;
        }
        return false;
    });

    const [isArchived, setIsArchived] = useState(link.isArchived || false);
    const [saveSuccess, setSaveSuccess] = useState(false); // For Done button cycle: text -> spinner -> check
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);
    // Initialize with shared src if available
    const [imgSrc, setImgSrc] = useState<string>(sharedImgSrc || '');
    const [isLoading, setIsLoading] = useState<boolean>(!sharedImgSrc); // Only load if no shared src

    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${link.url}`;

    useEffect(() => {
        getConfig().then((config) => {
            setBaseUrl(config.baseUrl);
            setApiKey(config.apiKey);
        });
    }, []);

    useEffect(() => {
        // If we already have a shared image source, don't re-fetch unless link.preview changed
        if (sharedImgSrc) {
            setImgSrc(sharedImgSrc);
            setIsLoading(false);
            return;
        }

        // Priority 1: Check IndexedDB cache first (instant display)
        getThumbnail(link.url).then(cachedThumbnail => {
            if (cachedThumbnail) {
                setImgSrc(cachedThumbnail);
                if (onImgSrcChange) onImgSrcChange(cachedThumbnail);
                setIsLoading(false);
                return;
            }

            // Priority 2: Fall back to API preview
            if (link.preview && baseUrl) {
                setIsLoading(true);
                // Use the API route that the dashboard uses, which serves the file correctly (authenticated)
                const url = `${baseUrl.replace(/\/$/, '')}/api/v1/archives/${link.id}?format=1&preview=true`;

                // Fetch via background to avoid Mixed Content
                chrome.runtime.sendMessage({
                    type: 'FETCH_IMAGE_BLOB',
                    data: { url }
                }, (response) => {
                    if (response && response.success && response.data?.base64Data) {
                        const newData = response.data.base64Data;
                        setImgSrc(newData);
                        if (onImgSrcChange) onImgSrcChange(newData);
                    } else {
                        setImgSrc(faviconUrl);
                    }
                    setIsLoading(false);
                });
            } else {
                setImgSrc(faviconUrl);
                setIsLoading(false);
            }
        });
    }, [link.preview, baseUrl, link.url, faviconUrl, sharedImgSrc, onImgSrcChange]);

    const form = useForm<EditLinkFormValues>({
        resolver: zodResolver(editLinkFormSchema),
        defaultValues: {
            name: link.name || '',
            description: link.description || '',
            collection: link.collection || { name: t('editLink.unorganized') },
            // @ts-ignore
            tags: link.tags || [],
        },
    });

    // Reset saveSuccess when form becomes dirty (user makes changes after saving)
    useEffect(() => {
        if (form.formState.isDirty && saveSuccess) {
            setSaveSuccess(false);
        }
    }, [form.formState.isDirty, saveSuccess]);

    // Queries for Collections and Tags
    const { data: collections, isLoading: loadingCollections } = useQuery({
        queryKey: ['collections'],
        queryFn: async () => {
            const response = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' });
            if (!response.success) throw new Error(response.error);
            return response.data.response.sort((a: any, b: any) =>
                (a.name || '').localeCompare(b.name || '')
            );
        },
    });

    // Queries for Tags (Direct Fetch)
    const { data: tags, isLoading: loadingTags } = useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            // @ts-ignore
            const response = await chrome.runtime.sendMessage({ type: 'GET_TAGS' });
            if (!response.success) throw new Error(response.error);
            const rawTags = response.data?.response || response.data || [];
            if (!Array.isArray(rawTags)) return [];
            return rawTags.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        },
    });

    // AI Tag suggestion state
    const { data: userProfile } = useQuery({
        queryKey: ['userProfile'],
        queryFn: () => apiKey && baseUrl ? getCurrentUser(baseUrl, apiKey) : Promise.reject('No config'),
        enabled: !!apiKey && !!baseUrl,
        retry: 1,
    });

    const [isSuggestingTags, setIsSuggestingTags] = useState(false);

    // Handle AI tag suggestion
    const handleSuggestTags = async () => {
        if (isSuggestingTags) return;

        setIsSuggestingTags(true);
        try {
            // Use existing link data for AI
            const title = form.getValues('name') || link.name || '';
            const description = form.getValues('description') || link.description || '';

            // @ts-ignore
            const response = await chrome.runtime.sendMessage({
                type: 'SUGGEST_TAGS',
                data: { url: link.url, title, description }
            });

            if (response.success && response.data?.tags?.length > 0) {
                // Merge AI suggested tags with existing selection
                const currentTags = form.getValues('tags') || [];
                const newTags = response.data.tags
                    .filter((tagName: string) => !currentTags.some(t => t.name === tagName))
                    .map((tagName: string) => ({ name: tagName }));

                if (newTags.length > 0) {
                    form.setValue('tags', [...currentTags, ...newTags]);
                    toast({
                        title: 'AI Tags Added',
                        description: `Added ${newTags.length} suggested tag${newTags.length > 1 ? 's' : ''}`,
                    });
                } else {
                    toast({
                        title: 'No New Tags',
                        description: 'All suggested tags are already selected',
                    });
                }
            } else if (!response.success) {
                toast({
                    title: 'AI Suggestion Failed',
                    description: response.error || 'Could not get tag suggestions',
                    variant: 'destructive',
                });
            }
        } catch (error) {

            toast({
                title: 'Error',
                description: 'Failed to get AI suggestions',
                variant: 'destructive',
            });
        } finally {
            setIsSuggestingTags(false);
        }
    };

    // Save Mutation
    const { mutate: handleSave, isLoading: isSaving } = useMutation({
        mutationFn: async (values: EditLinkFormValues) => {


            const body = {
                id: link.id,
                url: link.url,
                name: values.name,
                description: values.description,
                collection: values.collection?.id ? { id: values.collection.id, ownerId: values.collection.ownerId! } : { name: values.collection?.name || t('editLink.unorganized') },
                tags: (values.tags || []).map((t) => ({ name: t.name })),
                updatedAt: new Date().toISOString(),
            };

            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_LINK',
                data: { id: link.id, payload: body },
            });

            if (!response.success) {

                throw new Error(response.error);
            }
            return response.data?.response || body;
        },
        onSuccess: (data) => {
            setSaveSuccess(true);
            form.reset(form.getValues(), { keepValues: true });
            if (onUpdate) {
                const formValues = form.getValues();
                const latestBody = {
                    name: formValues.name,
                    description: formValues.description,
                    collection: formValues.collection ? { ...formValues.collection } : undefined,
                    tags: (formValues.tags || []).map(t => ({ name: t.name })),
                };

                const mergedUpdate = {
                    ...link,
                    ...latestBody,
                    ...(data?.response || data || {}),
                };

                onUpdate(mergedUpdate);
            }
        },
        onError: (err: any) => {
            toast({
                title: t('editLink.error'),
                description: err.message || t('editLink.updateFailed'),
                variant: "destructive",
            });
        },
    });

    // Pin Mutation
    const { mutate: handlePin, isLoading: isPinning } = useMutation({
        mutationFn: async () => {
            const payload = {
                id: Number(link.id),
                linkId: Number(link.id)
            };

            const response = await chrome.runtime.sendMessage({
                type: isPinned ? 'UNPIN_LINK' : 'PIN_LINK',
                data: payload,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to update pin status');
            }
            return !isPinned;
        },
        onSuccess: (nowPinned) => {
            setIsPinned(nowPinned);
        },
        onError: (err: any) => {
            toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        },
    });

    // Delete Mutation
    const { mutate: handleDelete, isLoading: isDeleting } = useMutation({
        mutationFn: async () => {
            const response = await chrome.runtime.sendMessage({
                type: 'DELETE_LINK',
                data: { id: link.id },
            });
            if (!response.success) throw new Error(response.error);
            return response.data;
        },
        onSuccess: () => {
            if (onDelete) onDelete();
            onClose();
        },
        onError: (err: any) => {
            toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        },
    });

    // Archive Mutation
    const { mutate: handleArchive, isLoading: isArchiving } = useMutation({
        mutationFn: async () => {
            const targetAction = isArchived ? 'unarchive' : 'archive';
            const response = await chrome.runtime.sendMessage({
                type: 'ARCHIVE_LINK',
                data: { id: link.id, action: targetAction },
            });
            if (!response.success) throw new Error(response.error);
            return !isArchived;
        },
        onSuccess: (nowArchived) => {
            setIsArchived(nowArchived);
            if (onUpdate) onUpdate({ isArchived: nowArchived });
        },
        onError: (err: any) => {
            toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        },
    });

    const handleOpenInSpark = () => {
        if (!link.id || !baseUrl) return;

        const linksRouteTo = userProfile?.linksRouteTo || 'MONOLITH';
        const formatMap: Record<string, number> = {
            'ORIGINAL': 999,
            'PDF': 0,
            'MONOLITH': 1,
            'SCREENSHOT': 2,
            'READABLE': 3,
            'DETAILS': 1,
        };
        const formatNum = formatMap[linksRouteTo] ?? 1;
        const previewUrl = `${baseUrl.replace(/\/$/, '')}/dashboard?openPreview=${link.id}&format=${formatNum}`;
        chrome.runtime.sendMessage({ type: 'OPEN_TAB', data: { url: previewUrl } });
    };

    return (
        <div className="flex flex-col h-full">
            <LinkHeader
                isPinned={isPinned}
                isPinning={isPinning}
                onPin={() => handlePin()}
                onBack={onBack}
                onClose={onClose}
            />

            {/* VOID Card - Link Details Only */}
            <div
                className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 p-4 flex-1 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                style={{
                    background: `linear-gradient(135deg, ${form.watch('collection')?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)`,
                }}
            >
                <LinkPreviewCard
                    imgSrc={imgSrc}
                    faviconUrl={faviconUrl}
                    isLoading={isLoading}
                    linkUrl={link.url}
                    form={form}
                />

                <EditLinkForm
                    form={form}
                    handleSave={(d) => handleSave(d)}
                    collections={collections}
                    loadingCollections={loadingCollections}
                    openCollections={openCollections}
                    setOpenCollections={setOpenCollections}
                    handleToggleCollections={handleToggleCollections}
                    tags={tags || []}
                    loadingTags={loadingTags}
                    openTags={openTags}
                    setOpenTags={(val) => {
                        setOpenTags(val);
                        if (val) setOpenCollections(false);
                    }}
                    userProfile={userProfile}
                    isSuggestingTags={isSuggestingTags}
                    handleSuggestTags={handleSuggestTags}
                    containerRef={containerRef || null}
                />
            </div>

            <LinkFooter
                form={form}
                onSave={form.handleSubmit((d) => handleSave(d))}
                saveSuccess={saveSuccess}
                isSaving={isSaving}
                isDeleting={isDeleting}
                onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
                isArchived={isArchived}
                isArchiving={isArchiving}
                onArchive={() => handleArchive()}
                onOpenInSpark={handleOpenInSpark}
            />

            <DeleteDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onDelete={() => {
                    handleDelete();
                    setShowDeleteConfirm(false);
                }}
            />

            <Toaster />
        </div>
    );
};
