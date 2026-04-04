import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Toaster } from './ui/Toaster';
import { getThumbnail } from '../lib/thumbnailCache';
import { fetchAuthorizedImageUrl } from '../lib/authorizedImageUrl';
import { LinkWithHighlights } from '../lib/types/highlight';
import { toast } from '../../hooks/use-toast';
import { getExtensionBootstrapState } from '../lib/actions/bootstrap';
import {
    archiveLinkMessage,
    deleteLinkMessage,
    openTabMessage,
    suggestTags,
    updateLinkMessage,
} from '../lib/runtime/messages';

import { LinkHeader } from './EditLink/LinkHeader';
import { LinkPreviewCard } from './EditLink/LinkPreviewCard';
import { EditLinkForm } from './EditLink/EditLinkForm';
import { LinkFooter } from './EditLink/LinkFooter';
import { DeleteDialog } from './EditLink/DeleteDialog';

const editLinkFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    collection: z.object({ id: z.number().optional(), name: z.string(), ownerId: z.number().optional(), color: z.string().nullable().optional(), icon: z.string().nullable().optional() }),
    tags: z.array(z.object({ id: z.number().optional(), name: z.string() })).optional(),
});

type EditLinkFormValues = z.infer<typeof editLinkFormSchema>;

interface EditLinkViewProps {
    link: LinkWithHighlights; onClose: () => void; onBack?: () => void; containerRef?: HTMLElement | null;
    onUpdate?: (updatedLink: Partial<LinkWithHighlights>) => void; sharedImgSrc?: string; onImgSrcChange?: (src: string) => void; onDelete?: () => void;
}

function buildUpdatePayload(link: LinkWithHighlights, values: EditLinkFormValues, pinnedBy?: any[]) {
    return {
        id: link.id,
        url: link.url,
        name: values.name,
        description: values.description,
        collection: values.collection?.id
            ? { id: values.collection.id, ownerId: values.collection.ownerId! }
            : { name: values.collection?.name || 'Unorganized' },
        tags: (values.tags || []).map((tag: any) => ({ name: tag.name })),
        updatedAt: new Date().toISOString(),
        ...(pinnedBy ? { pinnedBy } : {}),
    };
}

function useEditLinkMutations({ link, form, currentUserId, onUpdate, onClose, onDelete, t }: {
    link: LinkWithHighlights; form: any; currentUserId?: number | null; onUpdate?: (updatedLink: Partial<LinkWithHighlights>) => void;
    onClose: () => void; onDelete?: () => void; t: (key: string) => string;
}) {
    const [isPinned, setIsPinned] = useState(() => Array.isArray((link as any).pinnedBy) ? (link as any).pinnedBy.length > 0 : false);
    const [isArchived, setIsArchived] = useState(link.isArchived || false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isSuggestingTags, setIsSuggestingTags] = useState(false);

    const { mutate: handleSave, isLoading: isSaving } = useMutation({
        mutationFn: async (values: EditLinkFormValues) => {
            const body = buildUpdatePayload(link, values);
            const response = await updateLinkMessage(link.id, body);
            return response?.response || response || body;
        },
        onSuccess: (data) => {
            setSaveSuccess(true);
            form.reset(form.getValues(), { keepValues: true });
            if (onUpdate) {
                const fv = form.getValues();
                onUpdate({ ...link, name: fv.name, description: fv.description, collection: fv.collection ? { ...fv.collection } : undefined, tags: (fv.tags || []).map((tag: any) => ({ name: tag.name })), ...(data?.response || data || {}) } as any);
            }
        },
        onError: (err: any) => { toast({ title: t('editLink.error'), description: err.message || t('editLink.updateFailed'), variant: 'destructive' }); },
    });

    const { mutate: handlePin, isLoading: isPinning } = useMutation({
        mutationFn: async () => {
            if (!currentUserId) {
                throw new Error('Missing current user');
            }

            const values = form.getValues();
            const nextPinned = !isPinned;
            const body = buildUpdatePayload(link, values, nextPinned ? [{ id: currentUserId }] : [{ id: undefined }] as any);
            const response = await updateLinkMessage(link.id, body);
            return { nowPinned: nextPinned, response };
        },
        onSuccess: ({ nowPinned }) => {
            setIsPinned(nowPinned);
            if (onUpdate) {
                onUpdate({ pinnedBy: (nowPinned ? [{ id: currentUserId }] : []) as any } as any);
            }
        },
        onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
    });

    const { mutate: handleDelete, isLoading: isDeleting } = useMutation({
        mutationFn: async () => {
            await deleteLinkMessage(link.id);
        },
        onSuccess: () => { if (onDelete) onDelete(); onClose(); },
        onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
    });

    const { mutate: handleArchive, isLoading: isArchiving } = useMutation({
        mutationFn: async () => {
            await archiveLinkMessage(link.id, isArchived ? 'unarchive' : 'archive');
            return !isArchived;
        },
        onSuccess: (nowArchived) => { setIsArchived(nowArchived); if (onUpdate) onUpdate({ isArchived: nowArchived }); },
        onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
    });

    const handleSuggestTags = async () => {
        if (isSuggestingTags) return;
        setIsSuggestingTags(true);
        try {
            const title = form.getValues('name') || link.name || '';
            const description = form.getValues('description') || (link as any).description || '';
            const response = await suggestTags({ url: link.url, title, description });
            if (response.tags?.length > 0) {
                const currentTags = form.getValues('tags') || [];
                const newTags = response.tags.filter((name: string) => !currentTags.some((tag: any) => tag.name === name)).map((name: string) => ({ name }));
                if (newTags.length > 0) {
                    form.setValue('tags', [...currentTags, ...newTags]);
                    toast({ title: 'AI Tags Added', description: `Added ${newTags.length} suggested tag${newTags.length > 1 ? 's' : ''}` });
                } else {
                    toast({ title: 'No New Tags', description: 'All suggested tags are already selected' });
                }
            } else {
                toast({ title: 'No New Tags', description: 'No tag suggestions were returned' });
            }
        } catch (error: any) {
            toast({ title: 'AI Suggestion Failed', description: error?.message || 'Could not get tag suggestions', variant: 'destructive' });
        } finally {
            setIsSuggestingTags(false);
        }
    };

    return {
        handleSave, isSaving, saveSuccess, setSaveSuccess,
        handlePin, isPinned, isPinning,
        handleDelete, isDeleting,
        handleArchive, isArchived, isArchiving,
        isSuggestingTags, handleSuggestTags,
    };
}

export const EditLinkView = ({ link: rawLink, onClose, onBack, containerRef, onUpdate, sharedImgSrc, onImgSrcChange, onDelete }: EditLinkViewProps) => {
    const link = (rawLink as any)?.response || rawLink;
    const { t } = useTranslation();
    const [openCollections, setOpenCollections] = useState(false);
    const [openTags, setOpenTags] = useState(false);
    const ignoreNextOpenChange = useRef(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<any | null>(null);
    const [collections, setCollections] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [loadingBootstrap, setLoadingBootstrap] = useState(true);
    const [imgSrc, setImgSrc] = useState<string>(sharedImgSrc || '');
    const [isLoading, setIsLoading] = useState<boolean>(!sharedImgSrc);
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${link.url}`;

    useEffect(() => {
        let active = true;
        getExtensionBootstrapState().then((bootstrap) => {
            if (!active) return;
            setBaseUrl(bootstrap.baseUrl || bootstrap.config?.baseUrl || null);
            setUserProfile(bootstrap.user || null);
            setCollections(bootstrap.collections || []);
            setTags(bootstrap.tags || []);
            setLoadingBootstrap(false);
        }).catch(() => {
            if (!active) return;
            setLoadingBootstrap(false);
        });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;

        if (sharedImgSrc) {
            setImgSrc(sharedImgSrc);
            setIsLoading(false);
            return () => { active = false; };
        }

        const loadImage = async () => {
            const cached = await getThumbnail(link.url);
            if (!active) return;

            if (cached) {
                setImgSrc(cached);
                onImgSrcChange?.(cached);
                setIsLoading(false);
                return;
            }

            if (link.preview && baseUrl) {
                setIsLoading(true);
                try {
                    const objectUrl = await fetchAuthorizedImageUrl(`${baseUrl.replace(/\/$/, '')}/api/v1/archives/${link.id}?format=1&preview=true`);
                    if (!active) return;
                    if (objectUrl) {
                        setImgSrc(objectUrl);
                        onImgSrcChange?.(objectUrl);
                    } else {
                        setImgSrc(faviconUrl);
                    }
                } catch {
                    if (active) setImgSrc(faviconUrl);
                } finally {
                    if (active) setIsLoading(false);
                }
            } else {
                setImgSrc(faviconUrl);
                setIsLoading(false);
            }
        };

        void loadImage();
        return () => { active = false; };
    }, [link.preview, baseUrl, link.url, faviconUrl, sharedImgSrc, onImgSrcChange, link.id]);

    const form = useForm<EditLinkFormValues>({
        resolver: zodResolver(editLinkFormSchema),
        defaultValues: { name: link.name || '', description: link.description || '', collection: link.collection || { name: t('editLink.unorganized') }, tags: link.tags || [] },
    });

    const {
        handleSave, isSaving, saveSuccess, setSaveSuccess, handlePin, isPinned, isPinning,
        handleDelete, isDeleting, handleArchive, isArchived, isArchiving, isSuggestingTags, handleSuggestTags,
    } = useEditLinkMutations({ link, form, currentUserId: userProfile?.id, onUpdate, onClose, onDelete, t });

    useEffect(() => {
        if (form.formState.isDirty && saveSuccess) setSaveSuccess(false);
    }, [form.formState.isDirty, saveSuccess, setSaveSuccess]);

    const handleToggleCollections = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!openCollections) setOpenTags(false);
        ignoreNextOpenChange.current = true;
        setOpenCollections(prev => !prev);
        setTimeout(() => { ignoreNextOpenChange.current = false; }, 100);
    };

    const handleOpenInGrabSHARK = () => {
        if (!link.id || !baseUrl) return;
        const formatMap: Record<string, number> = { ORIGINAL: 999, PDF: 0, MONOLITH: 1, SCREENSHOT: 2, READABLE: 3, DETAILS: 1 };
        const formatNum = formatMap[userProfile?.linksRouteTo || 'MONOLITH'] ?? 1;
        void openTabMessage(`${baseUrl.replace(/\/$/, '')}/dashboard?openPreview=${link.id}&format=${formatNum}`).catch(() => { });
    };

    return (
        <div className="flex flex-col h-full">
            <LinkHeader isPinned={isPinned} isPinning={isPinning} onPin={() => handlePin()} onBack={onBack} onClose={onClose} />
            <div className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 p-4 flex-1 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: `linear-gradient(135deg, ${form.watch('collection')?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)` }}>
                <LinkPreviewCard imgSrc={imgSrc} faviconUrl={faviconUrl} isLoading={isLoading} linkUrl={link.url} form={form} />
                <EditLinkForm form={form} handleSave={(data) => handleSave(data)} collections={collections} loadingCollections={loadingBootstrap} openCollections={openCollections}
                    setOpenCollections={setOpenCollections} handleToggleCollections={handleToggleCollections} tags={tags || []} loadingTags={loadingBootstrap}
                    openTags={openTags} setOpenTags={(value) => { setOpenTags(value); if (value) setOpenCollections(false); }}
                    userProfile={userProfile} isSuggestingTags={isSuggestingTags} handleSuggestTags={handleSuggestTags} containerRef={containerRef || null} />
            </div>
            <LinkFooter form={form} onSave={form.handleSubmit((data) => handleSave(data))} saveSuccess={saveSuccess} isSaving={isSaving} isDeleting={isDeleting}
                onShowDeleteConfirm={() => setShowDeleteConfirm(true)} isArchived={isArchived} isArchiving={isArchiving} onArchive={() => handleArchive()} onOpenInGrabSHARK={handleOpenInGrabSHARK} />
            <DeleteDialog isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onDelete={() => { handleDelete(); setShowDeleteConfirm(false); }} />
            <Toaster />
        </div>
    );
};




