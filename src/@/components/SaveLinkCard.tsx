import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

import { openOptions, getCurrentTabInfo } from '../lib/utils';
import { bookmarkFormSchema, bookmarkFormValues } from '../lib/validators/bookmarkForm';
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
import { getExtensionBootstrapState } from '../lib/actions/bootstrap';
import { writeAiTagExpectation } from '../lib/runtime/sessionCache';
import {
    getRecentLinksData,
    openTabMessage,
    saveDomainPreference,
    saveLinkFromExtension,
    suggestTags,
} from '../lib/runtime/messages';

import { SaveLinkHeader } from './SaveLink/SaveLinkHeader';
import { SaveLinkPreview } from './SaveLink/SaveLinkPreview';
import { SaveLinkForm } from './SaveLink/SaveLinkForm';
import { SaveLinkFooter } from './SaveLink/SaveLinkFooter';
import { SaveLinkPageInteractions } from './SaveLink/SaveLinkPageInteractions';
import { CaptureOverlays } from './SaveLink/CaptureOverlays';

function useSaveLinkInit(form: UseFormReturn<bookmarkFormValues>) {
    const [currentUrl, setCurrentUrl] = useState('');
    const [initialTitle, setInitialTitle] = useState('');
    const [prefs, setPrefs] = useState<ExtensionPreferences>(DEFAULT_PREFERENCES);
    const [loadingPrefs, setLoadingPrefs] = useState(true);
    const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
    const [preProcessedThumbnail, setPreProcessedThumbnail] = useState<Blob | null>(null);
    const [userProfile, setUserProfile] = useState<any | null>(null);
    const [collections, setCollections] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [archiveDefaults, setArchiveDefaults] = useState<any | null>(null);
    const [loadingBootstrap, setLoadingBootstrap] = useState(true);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const tabInfo = await getCurrentTabInfo();

            if (tabInfo.url) {
                setCurrentUrl(tabInfo.url);
                form.setValue('url', tabInfo.url);
            }
            if (tabInfo.title) {
                setInitialTitle(tabInfo.title);
                form.setValue('name', tabInfo.title);
            }

            const getMetaContent = (selector: string): string | undefined =>
                document.querySelector(selector)?.getAttribute('content') || undefined;

            const extractedDescription =
                getMetaContent('meta[name="description"]') ||
                getMetaContent('meta[property="og:description"]') ||
                getMetaContent('meta[name="twitter:description"]') ||
                document.querySelector('p')?.textContent?.slice(0, 200) || '';

            const hostname = getHostname(tabInfo.url);
            let defaultCollection: any = { name: 'Unorganized' };

            try {
                const bootstrap = await getExtensionBootstrapState(hostname || undefined);
                setBaseUrl(bootstrap.baseUrl || bootstrap.config?.baseUrl || null);
                setUserProfile(bootstrap.user || null);
                setCollections(bootstrap.collections || []);
                setTags(bootstrap.tags || []);
                setArchiveDefaults(bootstrap.prefs || null);

                if (bootstrap.config?.defaultCollection) {
                    defaultCollection = { name: bootstrap.config.defaultCollection };
                }

                const user = bootstrap.user;
                const availableCollections = bootstrap.collections || [];
                if (user) {
                    const extensionPref = user.extensionDefaultCollection || 'UNORGANIZED';
                    const selectedColId = user.extensionSelectedCollectionId;

                    if (user.saveMetaDescriptionToNote && extractedDescription) {
                        form.setValue('description', extractedDescription);
                    }

                    if (extensionPref === 'SELECTED' && selectedColId) {
                        const selectedCol = availableCollections.find((c: any) => c.id === selectedColId);
                        if (selectedCol) {
                            defaultCollection = { name: selectedCol.name, id: selectedCol.id, ownerId: selectedCol.ownerId };
                        }
                    } else if (extensionPref === 'LAST_USED') {
                        const recentLinks = await getRecentLinksData();
                        if (recentLinks.length > 0) {
                            const lastLink = recentLinks[0];
                            if (lastLink.collection) {
                                defaultCollection = { name: lastLink.collection.name, id: lastLink.collection.id, ownerId: lastLink.collection.ownerId };
                            }
                        }
                    } else {
                        const defaultCol = availableCollections.find((c: any) => c.isDefault === true)
                            || availableCollections.find((c: any) => c.name === bootstrap.config?.defaultCollection);
                        if (defaultCol) {
                            defaultCollection = { name: defaultCol.name, id: defaultCol.id, ownerId: defaultCol.ownerId };
                        }
                    }
                }
            } catch {
            } finally {
                setLoadingBootstrap(false);
            }

            form.setValue('collection', defaultCollection as any);
            getEffectivePreferences(hostname).then((p) => {
                setPrefs(p);
                setLoadingPrefs(false);
            });

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
        void init();
    }, [form]);

    return {
        currentUrl,
        initialTitle,
        prefs,
        setPrefs,
        loadingPrefs,
        ogImageUrl,
        preProcessedThumbnail,
        userProfile,
        collections,
        tags,
        archiveDefaults,
        loadingBootstrap,
        baseUrl,
    };
}

function useSaveLinkMutation({
    form, currentUrl, prefs, archiveOptions, uploadScreenshot,
    ogImageUrl, preProcessedThumbnail, collections, baseUrl, onClose, onSuccess: onSuccessCallback, t,
}: {
    form: UseFormReturn<bookmarkFormValues>; currentUrl: string; prefs: ExtensionPreferences;
    archiveOptions: { archiveAsScreenshot: boolean; archiveAsMonolith: boolean; archiveAsPDF: boolean; archiveAsReadable: boolean; aiTag: boolean } | null;
    uploadScreenshot: boolean; ogImageUrl: string | null; preProcessedThumbnail: Blob | null;
    collections: any[] | undefined; baseUrl: string | null; onClose?: () => void; onSuccess?: (link: any, openEdit?: boolean) => void; t: (key: string) => string;
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
                tags: (values.tags || []).map((tag) => ({ name: tag.name })),
                preservationConfig: archiveOptions || { archiveAsScreenshot: true, archiveAsMonolith: true, archiveAsPDF: true, archiveAsReadable: true, aiTag: false },
                uploadImage: uploadScreenshot,
            };

            const data = await saveLinkFromExtension(payload, aiAuthored);
            return { link: data?.response || data, action };
        },
        onSuccess: (data) => {
            const { link, action } = data;
            const values = form.getValues();
            let optimisticThumbnailUrl: string | undefined;

            if (preProcessedThumbnail && currentUrl) {
                void saveThumbnail(currentUrl, preProcessedThumbnail).catch(() => { });
                optimisticThumbnailUrl = URL.createObjectURL(preProcessedThumbnail);
            } else if (ogImageUrl && currentUrl) {
                void processOgImage(ogImageUrl).then(async (blob) => { if (blob) await saveThumbnail(currentUrl, blob); }).catch(() => { });
            }

            const fullCollection = collections?.find((c: any) => c.id === values.collection?.id) || values.collection;
            const enrichedLink = {
                ...link,
                collection: { ...link?.collection, ...fullCollection, _expectAiTags: archiveOptions?.aiTag ?? false },
                _optimisticThumbnail: optimisticThumbnailUrl,
                _expectAiTags: archiveOptions?.aiTag ?? false,
            };
            writeAiTagExpectation(link.id, archiveOptions?.aiTag ?? false);

            const hostname = getHostname(currentUrl);
            if (hostname) {
                void getSiteOverrides().then(async (overrides) => {
                    const clientOverride = overrides[hostname];
                    await saveDomainPreference({
                        domain: hostname,
                        enableSmartCapture: clientOverride?.enableSmartCapture ?? prefs.enableSmartCapture,
                        enableSelectionMenu: clientOverride?.enableSelectionMenu ?? prefs.enableSelectionMenu,
                    });

                    if (clientOverride) {
                        await clearSiteOverride(hostname, 'enableSmartCapture');
                        await clearSiteOverride(hostname, 'enableSelectionMenu');
                    }
                }).catch(() => { });
            }

            if (action === 'open') {
                if (link?.id && baseUrl) {
                    void openTabMessage(`${baseUrl.replace(/\/$/, '')}/links/${link.id}`).catch(() => { });
                    if (onClose) onClose();
                } else if (onSuccessCallback) {
                    onSuccessCallback(enrichedLink, false);
                }
            } else {
                setSaveSuccess(true);
                if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
                successTimeoutRef.current = setTimeout(() => {
                    if (onSuccessCallback) onSuccessCallback(enrichedLink, false);
                }, 1000);
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
            const response = await suggestTags({ url: currentUrl, title, description });
            if (response?.tags?.length > 0) {
                const currentTags = form.getValues('tags') || [];
                const newTags = response.tags.filter((name: string) => !currentTags.some(tag => tag.name === name)).map((name: string) => ({ name }));
                if (newTags.length > 0) {
                    form.setValue('tags', [...currentTags, ...newTags]);
                    setAiAuthored(true);
                    toast({ title: 'AI Tags Added', description: `Added ${newTags.length} suggested tag${newTags.length > 1 ? 's' : ''}` });
                } else {
                    setAiAuthored(true);
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

    return { handleSave, isSaving, saveSuccess, isSuggestingTags, handleSuggestTags, successTimeoutRef };
}

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

    const {
        currentUrl,
        initialTitle,
        prefs,
        setPrefs,
        loadingPrefs,
        ogImageUrl,
        preProcessedThumbnail,
        userProfile,
        collections,
        tags,
        archiveDefaults,
        loadingBootstrap,
        baseUrl,
    } = useSaveLinkInit(form);

    useEffect(() => {
        setArchiveOptions(archiveDefaults || { archiveAsScreenshot: true, archiveAsMonolith: true, archiveAsPDF: true, archiveAsReadable: true, aiTag: false });
    }, [archiveDefaults]);

    const { handleSave, isSaving, saveSuccess, isSuggestingTags, handleSuggestTags, successTimeoutRef } =
        useSaveLinkMutation({ form, currentUrl, prefs, archiveOptions, uploadScreenshot, ogImageUrl, preProcessedThumbnail, collections, baseUrl, onClose, onSuccess, t });

    const watchedTags = form.watch('tags');
    useEffect(() => {
        const archivalTags = watchedTags?.filter((tag: any) => tag.archiveAsScreenshot || tag.archiveAsMonolith || tag.archiveAsPDF || tag.archiveAsReadable || tag.archiveAsWaybackMachine || tag.aiTag) || [];
        if (archivalTags.length > 0) {
            setArchiveOptions({
                archiveAsScreenshot: archivalTags.some((tag: any) => tag.archiveAsScreenshot),
                archiveAsMonolith: archivalTags.some((tag: any) => tag.archiveAsMonolith),
                archiveAsPDF: archivalTags.some((tag: any) => tag.archiveAsPDF),
                archiveAsReadable: archivalTags.some((tag: any) => tag.archiveAsReadable),
                aiTag: archivalTags.some((tag: any) => tag.aiTag),
            });
        } else if (userProfile) {
            setArchiveOptions(prev => ({
                archiveAsScreenshot: userProfile.archiveAsScreenshot ?? true,
                archiveAsMonolith: userProfile.archiveAsMonolith ?? true,
                archiveAsPDF: userProfile.archiveAsPDF ?? true,
                archiveAsReadable: userProfile.archiveAsReadable ?? true,
                aiTag: (manualTaggingRef.current || manualAiToggleRef.current)
                    ? (prev?.aiTag ?? false)
                    : (userProfile.aiTaggingMethod !== 'DISABLED' && userProfile.aiTaggingMethod !== undefined),
            }));
        }
    }, [watchedTags, userProfile]);

    useEffect(() => () => {
        if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    }, [successTimeoutRef]);

    useEffect(() => {
        if (showCaptureConfirmation) {
            let rafId = requestAnimationFrame(() => { rafId = requestAnimationFrame(() => setCaptureOverlayVisible(true)); });
            return () => cancelAnimationFrame(rafId);
        }
        setCaptureOverlayVisible(false);
    }, [showCaptureConfirmation]);

    const handleCloseCapture = () => {
        setCaptureOverlayVisible(false);
        setTimeout(() => setShowCaptureConfirmation(false), 250);
    };

    const handleToggle = async (key: keyof ExtensionPreferences) => {
        const newPrefs = { ...prefs, [key]: !prefs[key] };
        setPrefs(newPrefs);
        if (key === 'enableSmartCapture' || key === 'enableSelectionMenu') {
            const hostname = getHostname(currentUrl);
            if (hostname) await saveSiteOverride(hostname, key as keyof SiteOverride, !prefs[key] as boolean);
        } else {
            await savePreferences(newPrefs);
        }
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
                    <SaveLinkForm form={form} formSubmit={(e: any) => e.preventDefault()} collections={collections} loadingCollections={loadingBootstrap}
                        openCollections={openCollections} setOpenCollections={setOpenCollections} tags={tags || []} loadingTags={loadingBootstrap}
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


