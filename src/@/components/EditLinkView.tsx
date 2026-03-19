import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Toaster } from './ui/Toaster';
import { getThumbnail } from '../lib/thumbnailCache';
import { LinkWithHighlights } from '../lib/types/highlight';
import { getConfig } from '../lib/config';
import { getCurrentUser } from '../lib/actions/users';
import { toast } from '../../hooks/use-toast';

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

// --- Edit Link Mutations (inlined from useEditLinkMutations) ---

function useEditLinkMutations({ link, form, onUpdate, onClose, onDelete, t }: {
    link: LinkWithHighlights; form: any; onUpdate?: (updatedLink: Partial<LinkWithHighlights>) => void;
    onClose: () => void; onDelete?: () => void; t: (key: string) => string;
}) {
    const [isPinned, setIsPinned] = useState(() => Array.isArray((link as any).pinnedBy) ? (link as any).pinnedBy.length > 0 : false);
    const [isArchived, setIsArchived] = useState(link.isArchived || false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isSuggestingTags, setIsSuggestingTags] = useState(false);

    // Save
    const { mutate: handleSave, isLoading: isSaving } = useMutation({
        mutationFn: async (values: any) => {
            const body = {
                id: link.id, url: link.url, name: values.name, description: values.description,
                collection: values.collection?.id ? { id: values.collection.id, ownerId: values.collection.ownerId! } : { name: values.collection?.name || t('editLink.unorganized') },
                tags: (values.tags || []).map((tg: any) => ({ name: tg.name })),
                updatedAt: new Date().toISOString(),
            };
            const response = await chrome.runtime.sendMessage({ type: 'UPDATE_LINK', data: { id: link.id, payload: body } });
            if (!response.success) throw new Error(response.error);
            return response.data?.response || body;
        },
        onSuccess: (data) => {
            setSaveSuccess(true);
            form.reset(form.getValues(), { keepValues: true });
            if (onUpdate) {
                const fv = form.getValues();
                onUpdate({ ...link, name: fv.name, description: fv.description, collection: fv.collection ? { ...fv.collection } : undefined, tags: (fv.tags || []).map((tg: any) => ({ name: tg.name })), ...(data?.response || data || {}) } as any);
            }
        },
        onError: (err: any) => { toast({ title: t('editLink.error'), description: err.message || t('editLink.updateFailed'), variant: 'destructive' }); },
    });

    // Pin
    const { mutate: handlePin, isLoading: isPinning } = useMutation({
        mutationFn: async () => {
            const response = await chrome.runtime.sendMessage({ type: isPinned ? 'UNPIN_LINK' : 'PIN_LINK', data: { id: Number(link.id), linkId: Number(link.id) } });
            if (!response.success) throw new Error(response.error || 'Failed to update pin status');
            return !isPinned;
        },
        onSuccess: (nowPinned) => setIsPinned(nowPinned),
        onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
    });

    // Delete
    const { mutate: handleDelete, isLoading: isDeleting } = useMutation({
        mutationFn: async () => {
            const response = await chrome.runtime.sendMessage({ type: 'DELETE_LINK', data: { id: link.id } });
            if (!response.success) throw new Error(response.error);
            return response.data;
        },
        onSuccess: () => { if (onDelete) onDelete(); onClose(); },
        onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
    });

    // Archive
    const { mutate: handleArchive, isLoading: isArchiving } = useMutation({
        mutationFn: async () => {
            const response = await chrome.runtime.sendMessage({ type: 'ARCHIVE_LINK', data: { id: link.id, action: isArchived ? 'unarchive' : 'archive' } });
            if (!response.success) throw new Error(response.error);
            return !isArchived;
        },
        onSuccess: (nowArchived) => { setIsArchived(nowArchived); if (onUpdate) onUpdate({ isArchived: nowArchived }); },
        onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
    });

    // AI Tag Suggestion
    const handleSuggestTags = async () => {
        if (isSuggestingTags) return;
        setIsSuggestingTags(true);
        try {
            const title = form.getValues('name') || link.name || '';
            const description = form.getValues('description') || (link as any).description || '';
            // @ts-ignore
            const response = await chrome.runtime.sendMessage({ type: 'SUGGEST_TAGS', data: { url: link.url, title, description } });
            if (response.success && response.data?.tags?.length > 0) {
                const currentTags = form.getValues('tags') || [];
                const newTags = response.data.tags.filter((n: string) => !currentTags.some((tg: any) => tg.name === n)).map((n: string) => ({ name: n }));
                if (newTags.length > 0) { form.setValue('tags', [...currentTags, ...newTags]); toast({ title: 'AI Tags Added', description: `Added ${newTags.length} suggested tag${newTags.length > 1 ? 's' : ''}` }); }
                else toast({ title: 'No New Tags', description: 'All suggested tags are already selected' });
            } else if (!response.success) toast({ title: 'AI Suggestion Failed', description: response.error || 'Could not get tag suggestions', variant: 'destructive' });
        } catch { toast({ title: 'Error', description: 'Failed to get AI suggestions', variant: 'destructive' }); }
        finally { setIsSuggestingTags(false); }
    };

    return {
        handleSave, isSaving, saveSuccess, setSaveSuccess,
        handlePin, isPinned, isPinning,
        handleDelete, isDeleting,
        handleArchive, isArchived, isArchiving,
        isSuggestingTags, handleSuggestTags,
    };
}

// --- EditLinkView Component ---

export const EditLinkView = ({ link: rawLink, onClose, onBack, containerRef, onUpdate, sharedImgSrc, onImgSrcChange, onDelete }: EditLinkViewProps) => {
    const link = (rawLink as any)?.response || rawLink;
    const { t } = useTranslation();
    const [openCollections, setOpenCollections] = useState(false);
    const [openTags, setOpenTags] = useState(false);
    const ignoreNextOpenChange = useRef(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [imgSrc, setImgSrc] = useState<string>(sharedImgSrc || '');
    const [isLoading, setIsLoading] = useState<boolean>(!sharedImgSrc);
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${link.url}`;

    useEffect(() => { getConfig().then(c => { setBaseUrl(c.baseUrl); setApiKey(c.apiKey); }); }, []);

    // Image loading
    useEffect(() => {
        if (sharedImgSrc) { setImgSrc(sharedImgSrc); setIsLoading(false); return; }
        getThumbnail(link.url).then(cached => {
            if (cached) { setImgSrc(cached); onImgSrcChange?.(cached); setIsLoading(false); return; }
            if (link.preview && baseUrl) {
                setIsLoading(true);
                chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_BLOB', data: { url: `${baseUrl.replace(/\/$/, '')}/api/v1/archives/${link.id}?format=1&preview=true` } }, (r) => {
                    if (r?.success && r.data?.base64Data) { setImgSrc(r.data.base64Data); onImgSrcChange?.(r.data.base64Data); } else setImgSrc(faviconUrl);
                    setIsLoading(false);
                });
            } else { setImgSrc(faviconUrl); setIsLoading(false); }
        });
    }, [link.preview, baseUrl, link.url, faviconUrl, sharedImgSrc, onImgSrcChange]);

    const form = useForm<EditLinkFormValues>({
        resolver: zodResolver(editLinkFormSchema),
        defaultValues: { name: link.name || '', description: link.description || '', collection: link.collection || { name: t('editLink.unorganized') }, tags: link.tags || [] },
    });

    const { data: collections, isLoading: loadingCollections } = useQuery({
        queryKey: ['collections'],
        queryFn: async () => { const r = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' }); if (!r.success) throw new Error(r.error); return r.data.response.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')); },
    });
    const { data: tags, isLoading: loadingTags } = useQuery({
        queryKey: ['tags'],
        queryFn: async () => { const r = await chrome.runtime.sendMessage({ type: 'GET_TAGS' }); if (!r.success) throw new Error(r.error); const raw = r.data?.response || r.data || []; return Array.isArray(raw) ? raw.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')) : []; },
    });
    const { data: userProfile } = useQuery({ queryKey: ['userProfile'], queryFn: () => apiKey && baseUrl ? getCurrentUser(baseUrl, apiKey) : Promise.reject('No config'), enabled: !!apiKey && !!baseUrl, retry: 1 });

    const {
        handleSave, isSaving, saveSuccess, setSaveSuccess, handlePin, isPinned, isPinning,
        handleDelete, isDeleting, handleArchive, isArchived, isArchiving, isSuggestingTags, handleSuggestTags,
    } = useEditLinkMutations({ link, form, onUpdate, onClose, onDelete, t });

    useEffect(() => { if (form.formState.isDirty && saveSuccess) setSaveSuccess(false); }, [form.formState.isDirty, saveSuccess]);

    const handleToggleCollections = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!openCollections) setOpenTags(false);
        ignoreNextOpenChange.current = true;
        setOpenCollections(prev => !prev);
        setTimeout(() => { ignoreNextOpenChange.current = false; }, 100);
    };

    const handleOpenInGrabSHARK = () => {
        if (!link.id || !baseUrl) return;
        const formatMap: Record<string, number> = { 'ORIGINAL': 999, 'PDF': 0, 'MONOLITH': 1, 'SCREENSHOT': 2, 'READABLE': 3, 'DETAILS': 1 };
        const formatNum = formatMap[userProfile?.linksRouteTo || 'MONOLITH'] ?? 1;
        chrome.runtime.sendMessage({ type: 'OPEN_TAB', data: { url: `${baseUrl.replace(/\/$/, '')}/dashboard?openPreview=${link.id}&format=${formatNum}` } });
    };

    return (
        <div className="flex flex-col h-full">
            <LinkHeader isPinned={isPinned} isPinning={isPinning} onPin={() => handlePin()} onBack={onBack} onClose={onClose} />
            <div className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 p-4 flex-1 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: `linear-gradient(135deg, ${form.watch('collection')?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)` }}>
                <LinkPreviewCard imgSrc={imgSrc} faviconUrl={faviconUrl} isLoading={isLoading} linkUrl={link.url} form={form} />
                <EditLinkForm form={form} handleSave={(d) => handleSave(d)} collections={collections} loadingCollections={loadingCollections} openCollections={openCollections}
                    setOpenCollections={setOpenCollections} handleToggleCollections={handleToggleCollections} tags={tags || []} loadingTags={loadingTags}
                    openTags={openTags} setOpenTags={(val) => { setOpenTags(val); if (val) setOpenCollections(false); }}
                    userProfile={userProfile} isSuggestingTags={isSuggestingTags} handleSuggestTags={handleSuggestTags} containerRef={containerRef || null} />
            </div>
            <LinkFooter form={form} onSave={form.handleSubmit((d) => handleSave(d))} saveSuccess={saveSuccess} isSaving={isSaving} isDeleting={isDeleting}
                onShowDeleteConfirm={() => setShowDeleteConfirm(true)} isArchived={isArchived} isArchiving={isArchiving} onArchive={() => handleArchive()} onOpenInGrabSHARK={handleOpenInGrabSHARK} />
            <DeleteDialog isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onDelete={() => { handleDelete(); setShowDeleteConfirm(false); }} />
            <Toaster />
        </div>
    );
};
