import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';

import { openOptions, getCurrentTabInfo } from '../lib/utils';
import { getCurrentUser } from '../lib/actions/users';
import { bookmarkFormSchema, bookmarkFormValues } from '../lib/validators/bookmarkForm';
import { getConfig } from '../lib/config';
import { processOgImage } from '../lib/imageProcessor';
import { saveThumbnail } from '../lib/thumbnailCache';
import { Toaster } from './ui/Toaster';
import { toast } from '../../hooks/use-toast';
import {
    DEFAULT_PREFERENCES, ExtensionPreferences,
    savePreferences, saveSiteOverride, getHostname, getEffectivePreferences,
    getSiteOverrides, clearSiteOverride,
    SiteOverride,
} from '../lib/settings';

// Sub-components
import { SaveLinkHeader } from './SaveLink/SaveLinkHeader';
import { SaveLinkPreview } from './SaveLink/SaveLinkPreview';
import { SaveLinkForm } from './SaveLink/SaveLinkForm';
import { SaveLinkFooter } from './SaveLink/SaveLinkFooter';
import { SaveLinkPageInteractions } from './SaveLink/SaveLinkPageInteractions';
import { CaptureOverlays } from './SaveLink/CaptureOverlays';

// --- Save Link Init (inlined from useSaveLinkInit) ---

function useSaveLinkInit(form: UseFormReturn<bookmarkFormValues>) {
    const [currentUrl, setCurrentUrl] = useState('');
    const [initialTitle, setInitialTitle] = useState('');
    const [config, setConfig] = useState<{ baseUrl: string; apiKey: string } | null>(null);
    const [prefs, setPrefs] = useState<ExtensionPreferences>(DEFAULT_PREFERENCES);
    const [loadingPrefs, setLoadingPrefs] = useState(true);
    const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
    const [preProcessedThumbnail, setPreProcessedThumbnail] = useState<Blob | null>(null);

    useEffect(() => {
        const init = async () => {
            const tabInfo = await getCurrentTabInfo();
            const loadedConfig = await getConfig();
            setConfig(loadedConfig);

            if (tabInfo.url) { setCurrentUrl(tabInfo.url); form.setValue('url', tabInfo.url); }
            if (tabInfo.title) { setInitialTitle(tabInfo.title); form.setValue('name', tabInfo.title); }

            const getMetaContent = (selector: string): string | undefined =>
                document.querySelector(selector)?.getAttribute("content") || undefined;

            const extractedDescription =
                getMetaContent('meta[name="description"]') ||
                getMetaContent('meta[property="og:description"]') ||
                getMetaContent('meta[name="twitter:description"]') ||
                document.querySelector('p')?.textContent?.slice(0, 200) || "";

            let defaultCollection: any = { name: loadedConfig.defaultCollection };
            try {
                const userResponse = await chrome.runtime.sendMessage({ type: 'GET_USER' });
                if (userResponse?.success && userResponse.data) {
                    const user = userResponse.data;
                    const extensionPref = user.extensionDefaultCollection || 'UNORGANIZED';
                    const selectedColId = user.extensionSelectedCollectionId;

                    if (user.saveMetaDescriptionToNote && extractedDescription) {
                        form.setValue('description', extractedDescription);
                    }

                    if (extensionPref === 'SELECTED' && selectedColId) {
                        const colResponse = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' });
                        if (colResponse?.success && colResponse.data) {
                            const collections = Array.isArray(colResponse.data) ? colResponse.data : (colResponse.data.response || []);
                            const selectedCol = collections.find((c: any) => c.id === selectedColId);
                            if (selectedCol) defaultCollection = { name: selectedCol.name, id: selectedCol.id, ownerId: selectedCol.ownerId };
                        }
                    } else if (extensionPref === 'LAST_USED') {
                        const linksResponse = await chrome.runtime.sendMessage({ type: 'GET_RECENT_LINKS' });
                        if (linksResponse?.success && linksResponse.data?.length > 0) {
                            const lastLink = linksResponse.data[0];
                            if (lastLink.collection) defaultCollection = { name: lastLink.collection.name, id: lastLink.collection.id, ownerId: lastLink.collection.ownerId };
                        }
                    } else {
                        const colResponse = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' });
                        if (colResponse?.success && colResponse.data) {
                            const collections = Array.isArray(colResponse.data) ? colResponse.data : (colResponse.data.response || []);
                            const defaultCol = collections.find((c: any) => c.isDefault === true) || collections.find((c: any) => c.name === loadedConfig.defaultCollection);
                            if (defaultCol) defaultCollection = { name: defaultCol.name, id: defaultCol.id, ownerId: defaultCol.ownerId };
                        }
                    }
                }
            } catch { }

            form.setValue('collection', defaultCollection as any);

            const hostname = getHostname(tabInfo.url);
            getEffectivePreferences(hostname).then((p) => { setPrefs(p); setLoadingPrefs(false); });

            const ogMeta = document.querySelector('meta[property="og:image"]');
            if (ogMeta) {
                let ogUrl = ogMeta.getAttribute('content');
                if (ogUrl) {
                    if (!ogUrl.startsWith('http://') && !ogUrl.startsWith('https://')) {
                        ogUrl = window.location.origin + (ogUrl.startsWith('/') ? ogUrl : '/' + ogUrl);
                    }
                    setOgImageUrl(ogUrl);
                    processOgImage(ogUrl).then((blob) => { if (blob) setPreProcessedThumbnail(blob); }).catch(() => { });
                }
            }
        };
        init();
    }, [form]);

    return { currentUrl, initialTitle, config, prefs, setPrefs, loadingPrefs, ogImageUrl, preProcessedThumbnail };
}

// --- Save Link Mutation (inlined from useSaveLinkMutation) ---

function useSaveLinkMutation({
    form, currentUrl, prefs, archiveOptions, uploadScreenshot,
    ogImageUrl, preProcessedThumbnail, collections, onClose, onSuccess: onSuccessCallback, t,
}: {
    form: UseFormReturn<bookmarkFormValues>; currentUrl: string; prefs: ExtensionPreferences;
    archiveOptions: { archiveAsScreenshot: boolean; archiveAsMonolith: boolean; archiveAsPDF: boolean; archiveAsReadable: boolean; aiTag: boolean } | null;
    uploadScreenshot: boolean; ogImageUrl: string | null; preProcessedThumbnail: Blob | null;
    collections: any[] | undefined; onClose?: () => void; onSuccess?: (link: any, openEdit?: boolean) => void; t: (key: string) => string;
}) {
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [aiAuthored, setAiAuthored] = useState(false);
    const [isSuggestingTags, setIsSuggestingTags] = useState(false);
    const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { mutate: handleSave, isLoading: isSaving } = useMutation({
        mutationFn: async (action: 'edit' | 'open') => {
            const values = form.getValues();
            const payload = {
                ...values,
                url: values.url || currentUrl,
                collection: { name: values.collection?.name, id: values.collection?.id, ownerId: values.collection?.ownerId },
                tags: (values.tags || []).map((t) => ({ name: t.name })),
                preservationConfig: archiveOptions || { archiveAsScreenshot: true, archiveAsMonolith: true, archiveAsPDF: true, archiveAsReadable: true, aiTag: false },
                uploadImage: uploadScreenshot,
            };

            const response = await chrome.runtime.sendMessage({
                type: 'SAVE_LINK_FROM_EXTENSION',
                data: { uploadImage: uploadScreenshot, values: payload, aiTagged: aiAuthored },
            });
            if (!response.success) throw new Error(response.error);
            return { link: response.data?.response || response.data, action };
        },
        onSuccess: (data) => {
            const { link, action } = data;
            const values = form.getValues();
            let optimisticThumbnailUrl: string | undefined;

            if (preProcessedThumbnail && currentUrl) {
                saveThumbnail(currentUrl, preProcessedThumbnail).catch(() => { });
                optimisticThumbnailUrl = URL.createObjectURL(preProcessedThumbnail);
            } else if (ogImageUrl && currentUrl) {
                processOgImage(ogImageUrl).then(async (blob) => { if (blob) await saveThumbnail(currentUrl, blob); }).catch(() => { });
            }

            const fullCollection = collections?.find((c: any) => c.id === values.collection?.id) || values.collection;
            const enrichedLink = {
                ...link,
                collection: { ...link?.collection, ...fullCollection, _expectAiTags: archiveOptions?.aiTag ?? false },
                _optimisticThumbnail: optimisticThumbnailUrl,
                _expectAiTags: archiveOptions?.aiTag ?? false,
            };

            try { sessionStorage.setItem(`link_ai_pref_${link.id}`, JSON.stringify({ expectAi: archiveOptions?.aiTag ?? false, timestamp: Date.now() })); } catch { }

            const hostname = getHostname(currentUrl);
            if (hostname) {
                getSiteOverrides().then(async (overrides) => {
                    const clientOverride = overrides[hostname];
                    chrome.runtime.sendMessage({
                        type: 'SET_DOMAIN_PREFERENCE',
                        data: { domain: hostname, enableSmartCapture: clientOverride?.enableSmartCapture ?? prefs.enableSmartCapture, enableSelectionMenu: clientOverride?.enableSelectionMenu ?? prefs.enableSelectionMenu },
                    }, (response) => {
                        if (response?.success && clientOverride) { clearSiteOverride(hostname, 'enableSmartCapture'); clearSiteOverride(hostname, 'enableSelectionMenu'); }
                    });
                }).catch(() => { });
            }

            if (action === 'open') {
                if (link?.id) {
                    getConfig().then(config => { chrome.tabs.create({ url: `${config.baseUrl}/links/${link.id}` }); if (onClose) onClose(); });
                } else if (onSuccessCallback) onSuccessCallback(enrichedLink, false);
            } else {
                setSaveSuccess(true);
                if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
                successTimeoutRef.current = setTimeout(() => { if (onSuccessCallback) onSuccessCallback(enrichedLink, false); }, 1000);
            }
        },
        onError: (err: any) => {
            toast({ title: t('saveLink.error') || t('common.error'), description: err.message || t('editLink.saveFailed'), variant: 'destructive' });
        },
    });

    const handleSuggestTags = async () => {
        if (isSuggestingTags) return;
        setIsSuggestingTags(true);
        try {
            const title = form.getValues('name') || document.title || '';
            const description = form.getValues('description') || '';
            // @ts-ignore
            const response = await chrome.runtime.sendMessage({ type: 'SUGGEST_TAGS', data: { url: currentUrl, title, description } });
            if (response.success && response.data?.tags?.length > 0) {
                const currentTags = form.getValues('tags') || [];
                const newTags = response.data.tags.filter((n: string) => !currentTags.some(t => t.name === n)).map((n: string) => ({ name: n }));
                if (newTags.length > 0) { form.setValue('tags', [...currentTags, ...newTags]); setAiAuthored(true); toast({ title: 'AI Tags Added', description: `Added ${newTags.length} suggested tag${newTags.length > 1 ? 's' : ''}` }); }
                else { setAiAuthored(true); toast({ title: 'No New Tags', description: 'All suggested tags are already selected' }); }
            } else if (!response.success) { toast({ title: 'AI Suggestion Failed', description: response.error || 'Could not get tag suggestions', variant: 'destructive' }); }
        } catch { toast({ title: 'Error', description: 'Failed to get AI suggestions', variant: 'destructive' }); }
        finally { setIsSuggestingTags(false); }
    };

    return { handleSave, isSaving, saveSuccess, isSuggestingTags, handleSuggestTags, aiAuthored, setAiAuthored, successTimeoutRef };
}

// --- SaveLinkCard Component ---

interface SaveLinkCardProps {
    onClose?: () => void;
    onSuccess?: (link: any, openEdit?: boolean) => void;
    onHideForCapture?: (callback: () => void) => void;
    onPreferences?: () => void;
    containerRef?: HTMLElement | null;
}

export const SaveLinkCard = ({ onClose, onSuccess, onHideForCapture, onPreferences, containerRef }: SaveLinkCardProps) => {
    const { t } = useTranslation();
    const [openCollections, setOpenCollections] = useState(false);
    const [openTags, setOpenTags] = useState(false);
    const [isDetailed, setIsDetailed] = useState(false);
    const [uploadScreenshot, setUploadScreenshot] = useState(false);
    const [showCaptureConfirmation, setShowCaptureConfirmation] = useState(false);
    const [captureOverlayVisible, setCaptureOverlayVisible] = useState(false);

    const [archiveOptions, setArchiveOptions] = useState<{
        archiveAsScreenshot: boolean; archiveAsMonolith: boolean; archiveAsPDF: boolean; archiveAsReadable: boolean; aiTag: boolean;
    } | null>(null);

    const manualTaggingRef = useRef(false);
    const manualAiToggleRef = useRef(false);

    const form = useForm<bookmarkFormValues>({
        resolver: zodResolver(bookmarkFormSchema),
        defaultValues: { url: '', name: '', collection: { name: t('bookmark.unorganized') }, tags: [], description: '', image: undefined },
    });

    const { currentUrl, initialTitle, config, prefs, setPrefs, loadingPrefs, ogImageUrl, preProcessedThumbnail } = useSaveLinkInit(form);

    // Cached archive preferences
    useEffect(() => {
        chrome.storage.local.get(['cached_user_prefs'], (result) => {
            setArchiveOptions(result.cached_user_prefs || { archiveAsScreenshot: true, archiveAsMonolith: true, archiveAsPDF: true, archiveAsReadable: true, aiTag: false });
        });
    }, []);

    const { data: userProfile } = useQuery({ queryKey: ['userProfile'], queryFn: () => getCurrentUser(config!.baseUrl, config!.apiKey), enabled: !!config });

    useEffect(() => {
        if (userProfile) {
            const newOptions = {
                archiveAsScreenshot: userProfile.archiveAsScreenshot ?? true, archiveAsMonolith: userProfile.archiveAsMonolith ?? true,
                archiveAsPDF: userProfile.archiveAsPDF ?? true, archiveAsReadable: userProfile.archiveAsReadable ?? true,
                aiTag: (userProfile.aiTaggingMethod !== 'DISABLED' && userProfile.aiTaggingMethod !== undefined),
            };
            setArchiveOptions(newOptions);
            chrome.storage.local.set({ 'cached_user_prefs': newOptions });
        }
    }, [userProfile]);

    const { data: collections, isLoading: loadingCollections } = useQuery({
        queryKey: ['collections'],
        queryFn: async () => {
            const response = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' });
            if (!response.success) throw new Error(response.error);
            return response.data.response.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        },
    });

    const { data: tags, isLoading: loadingTags } = useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const response = await chrome.runtime.sendMessage({ type: 'GET_TAGS' });
            if (!response.success) throw new Error(response.error);
            const rawTags = response.data?.response || response.data || [];
            return Array.isArray(rawTags) ? rawTags.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')) : [];
        },
    });

    const { handleSave, isSaving, saveSuccess, isSuggestingTags, handleSuggestTags, successTimeoutRef } =
        useSaveLinkMutation({ form, currentUrl, prefs, archiveOptions, uploadScreenshot, ogImageUrl, preProcessedThumbnail, collections, onClose, onSuccess, t });

    const watchedTags = form.watch('tags');
    useEffect(() => {
        const archivalTags = watchedTags?.filter((t: any) => t.archiveAsScreenshot || t.archiveAsMonolith || t.archiveAsPDF || t.archiveAsReadable || t.archiveAsWaybackMachine || t.aiTag) || [];
        if (archivalTags.length > 0) {
            setArchiveOptions({
                archiveAsScreenshot: archivalTags.some((t: any) => t.archiveAsScreenshot), archiveAsMonolith: archivalTags.some((t: any) => t.archiveAsMonolith),
                archiveAsPDF: archivalTags.some((t: any) => t.archiveAsPDF), archiveAsReadable: archivalTags.some((t: any) => t.archiveAsReadable), aiTag: archivalTags.some((t: any) => t.aiTag),
            });
        } else if (userProfile) {
            setArchiveOptions(prev => ({
                archiveAsScreenshot: userProfile.archiveAsScreenshot ?? true, archiveAsMonolith: userProfile.archiveAsMonolith ?? true,
                archiveAsPDF: userProfile.archiveAsPDF ?? true, archiveAsReadable: userProfile.archiveAsReadable ?? true,
                aiTag: (manualTaggingRef.current || manualAiToggleRef.current) ? (prev?.aiTag ?? false) : (userProfile.aiTaggingMethod !== 'DISABLED' && userProfile.aiTaggingMethod !== undefined),
            }));
        }
    }, [watchedTags, tags, userProfile]);

    useEffect(() => { return () => { if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current); }; }, []);

    useEffect(() => {
        if (showCaptureConfirmation) {
            let rafId = requestAnimationFrame(() => { rafId = requestAnimationFrame(() => setCaptureOverlayVisible(true)); });
            return () => cancelAnimationFrame(rafId);
        } else { setCaptureOverlayVisible(false); }
    }, [showCaptureConfirmation]);

    const handleCloseCapture = () => { setCaptureOverlayVisible(false); setTimeout(() => setShowCaptureConfirmation(false), 250); };

    const handleToggle = async (key: keyof ExtensionPreferences) => {
        const newPrefs = { ...prefs, [key]: !prefs[key] };
        setPrefs(newPrefs);
        if (key === 'enableSmartCapture' || key === 'enableSelectionMenu') {
            const hostname = getHostname(currentUrl);
            if (hostname) await saveSiteOverride(hostname, key as keyof SiteOverride, !prefs[key] as boolean);
        } else await savePreferences(newPrefs);
    };

    const faviconUrl = currentUrl ? `https://www.google.com/s2/favicons?sz=128&domain_url=${currentUrl}` : '';

    return (
        <div className="w-full relative">
            <div className="p-4">
                <SaveLinkHeader onClose={onClose} />
                <div className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                    style={{ background: `linear-gradient(135deg, ${(form.watch('collection') as any)?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)` }}>
                    <SaveLinkPreview currentUrl={currentUrl} faviconUrl={faviconUrl} form={form} initialTitle={initialTitle}
                        archiveOptions={archiveOptions} setArchiveOptions={setArchiveOptions} uploadScreenshot={uploadScreenshot}
                        setUploadScreenshot={setUploadScreenshot} userProfile={userProfile} manualAiToggleRef={manualAiToggleRef} />
                    <SaveLinkForm form={form} formSubmit={(e: any) => e.preventDefault()} collections={collections} loadingCollections={loadingCollections}
                        openCollections={openCollections} setOpenCollections={setOpenCollections} tags={tags || []} loadingTags={loadingTags}
                        openTags={openTags} setOpenTags={setOpenTags} isDetailed={isDetailed} setIsDetailed={setIsDetailed} userProfile={userProfile}
                        isSuggestingTags={isSuggestingTags} handleSuggestTags={handleSuggestTags} manualTaggingRef={manualTaggingRef}
                        setArchiveOptions={setArchiveOptions} containerRef={containerRef} />
                </div>
                <SaveLinkPageInteractions loadingPrefs={loadingPrefs} prefs={prefs} handleToggle={handleToggle} setPrefs={setPrefs} />
                <SaveLinkFooter onSave={() => { if (uploadScreenshot) setShowCaptureConfirmation(true); else handleSave('edit'); }}
                    isSaving={isSaving} saveSuccess={saveSuccess} onPreferences={onPreferences} openOptions={openOptions} />
            </div>
            <CaptureOverlays isSaving={isSaving} uploadScreenshot={uploadScreenshot} showCaptureConfirmation={showCaptureConfirmation}
                captureOverlayVisible={captureOverlayVisible} handleCloseCapture={handleCloseCapture}
                onStartCapture={() => { handleCloseCapture(); if (onHideForCapture) onHideForCapture(() => handleSave('edit')); else handleSave('edit'); }} />
            <Toaster />
        </div>
    );
};
