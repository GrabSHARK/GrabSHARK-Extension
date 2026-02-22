import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';

import { getCurrentTabInfo, openOptions } from '../lib/utils';
import { getConfig } from '../lib/config';
import { getCurrentUser } from '../lib/actions/users';
import { bookmarkFormSchema, bookmarkFormValues } from '../lib/validators/bookmarkForm';
import { Toaster } from './ui/Toaster';
import { processOgImage } from '../lib/imageProcessor';
import { saveThumbnail } from '../lib/thumbnailCache';

// Settings imports
import {
    DEFAULT_PREFERENCES,
    ExtensionPreferences,
    savePreferences,
    saveSiteOverride,
    getSiteOverrides,
    clearSiteOverride,
    getEffectivePreferences,
    getHostname,
    SiteOverride
} from '../lib/settings';

import { toast } from '../../hooks/use-toast';

// Sub-components
import { SaveLinkHeader } from './SaveLink/SaveLinkHeader';
import { SaveLinkPreview } from './SaveLink/SaveLinkPreview';
import { SaveLinkForm } from './SaveLink/SaveLinkForm';
import { SaveLinkFooter } from './SaveLink/SaveLinkFooter';
import { SaveLinkPageInteractions } from './SaveLink/SaveLinkPageInteractions';
import { CaptureOverlays } from './SaveLink/CaptureOverlays';

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
    const [saveSuccess, setSaveSuccess] = useState(false);
    const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial values
    const [initialTitle, setInitialTitle] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');

    // Settings state
    const [prefs, setPrefs] = useState<ExtensionPreferences>(DEFAULT_PREFERENCES);
    const [loadingPrefs, setLoadingPrefs] = useState(true);

    // Configuration state
    const [config, setConfig] = useState<{ baseUrl: string; apiKey: string } | null>(null);

    // Archive options state
    const [archiveOptions, setArchiveOptions] = useState<{
        archiveAsScreenshot: boolean;
        archiveAsMonolith: boolean;
        archiveAsPDF: boolean;
        archiveAsReadable: boolean;
        aiTag: boolean;
    } | null>(null);

    // Manual screenshot state
    const [uploadScreenshot, setUploadScreenshot] = useState(false);
    const [showCaptureConfirmation, setShowCaptureConfirmation] = useState(false);
    const [captureOverlayVisible, setCaptureOverlayVisible] = useState(false);

    // OG image for client-side thumbnail processing
    const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
    // Speculative pre-processed thumbnail
    const [preProcessedThumbnail, setPreProcessedThumbnail] = useState<Blob | null>(null);

    // AI Tag suggestion state
    const [isSuggestingTags, setIsSuggestingTags] = useState(false);
    // Track if AI suggestions were used
    const [aiAuthored, setAiAuthored] = useState(false);

    // Load cached preferences on mount
    useEffect(() => {
        chrome.storage.local.get(['cached_user_prefs'], (result) => {
            if (result.cached_user_prefs) {
                setArchiveOptions(result.cached_user_prefs);
            } else {
                setArchiveOptions({
                    archiveAsScreenshot: true,
                    archiveAsMonolith: true,
                    archiveAsPDF: true,
                    archiveAsReadable: true,
                    aiTag: false,
                });
            }
        });
    }, []);

    // Handle fade-in animation when overlay mounts
    useEffect(() => {
        if (showCaptureConfirmation) {
            let rafId: number;
            rafId = requestAnimationFrame(() => {
                rafId = requestAnimationFrame(() => {
                    setCaptureOverlayVisible(true);
                });
            });
            return () => cancelAnimationFrame(rafId);
        } else {
            setCaptureOverlayVisible(false);
        }
    }, [showCaptureConfirmation]);

    const handleCloseCapture = () => {
        setCaptureOverlayVisible(false);
        setTimeout(() => {
            setShowCaptureConfirmation(false);
        }, 250);
    };

    // Form logic
    const form = useForm<bookmarkFormValues>({
        resolver: zodResolver(bookmarkFormSchema),
        defaultValues: {
            url: '',
            name: '',
            collection: { name: t('bookmark.unorganized') },
            tags: [],
            description: '',
            image: undefined,
        },
    });

    // Queries for User Profile
    const { data: userProfile } = useQuery({
        queryKey: ['userProfile'],
        queryFn: () => getCurrentUser(config!.baseUrl, config!.apiKey),
        enabled: !!config,
    });

    // Sync archive options with User Profile
    useEffect(() => {
        if (userProfile) {
            const newOptions = {
                archiveAsScreenshot: userProfile.archiveAsScreenshot ?? true,
                archiveAsMonolith: userProfile.archiveAsMonolith ?? true,
                archiveAsPDF: userProfile.archiveAsPDF ?? true,
                archiveAsReadable: userProfile.archiveAsReadable ?? true,
                aiTag: (userProfile.aiTaggingMethod !== 'DISABLED' && userProfile.aiTaggingMethod !== undefined),
            };
            setArchiveOptions(newOptions);
            chrome.storage.local.set({ 'cached_user_prefs': newOptions });
        }
    }, [userProfile]);

    // Initialize
    useEffect(() => {
        const init = async () => {
            const tabInfo = await getCurrentTabInfo();
            const loadedConfig = await getConfig();
            setConfig(loadedConfig);

            if (tabInfo.url) {
                setCurrentUrl(tabInfo.url);
                form.setValue('url', tabInfo.url);
            }
            if (tabInfo.title) {
                setInitialTitle(tabInfo.title);
                form.setValue('name', tabInfo.title);
            }

            // ROBUST METADATA EXTRACTION
            const getMetaContent = (selector: string): string | undefined => {
                const el = document.querySelector(selector);
                return el?.getAttribute("content") || undefined;
            };

            const extractedDescription =
                getMetaContent('meta[name="description"]') ||
                getMetaContent('meta[property="og:description"]') ||
                getMetaContent('meta[name="twitter:description"]') ||
                document.querySelector('p')?.textContent?.slice(0, 200) ||
                "";

            const pendingDescription = extractedDescription;

            // Set default collection — always resolve by ID, not just name
            let defaultCollection: any = { name: loadedConfig.defaultCollection };

            try {
                const userResponse = await chrome.runtime.sendMessage({ type: 'GET_USER' });
                if (userResponse?.success && userResponse.data) {
                    const user = userResponse.data;
                    const extensionPref = user.extensionDefaultCollection || 'UNORGANIZED';
                    const selectedColId = user.extensionSelectedCollectionId;

                    const shouldSaveDescription = user.saveMetaDescriptionToNote === true;

                    if (shouldSaveDescription && pendingDescription) {
                        form.setValue('description', pendingDescription);
                    }

                    if (extensionPref === 'SELECTED' && selectedColId) {
                        const colResponse = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' });
                        if (colResponse?.success && colResponse.data) {
                            const collections = Array.isArray(colResponse.data)
                                ? colResponse.data
                                : (colResponse.data.response || []);
                            const selectedCol = collections.find((c: any) => c.id === selectedColId);
                            if (selectedCol) {
                                defaultCollection = {
                                    name: selectedCol.name,
                                    id: selectedCol.id,
                                    ownerId: selectedCol.ownerId
                                };
                            }
                        }
                    } else if (extensionPref === 'LAST_USED') {
                        const linksResponse = await chrome.runtime.sendMessage({ type: 'GET_RECENT_LINKS' });
                        if (linksResponse?.success && linksResponse.data?.length > 0) {
                            const lastLink = linksResponse.data[0];
                            if (lastLink.collection) {
                                defaultCollection = {
                                    name: lastLink.collection.name,
                                    id: lastLink.collection.id,
                                    ownerId: lastLink.collection.ownerId
                                };
                            }
                        }
                    } else {
                        // UNORGANIZED mode: resolve by ID from collections API
                        const colResponse = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' });
                        if (colResponse?.success && colResponse.data) {
                            const collections = Array.isArray(colResponse.data)
                                ? colResponse.data
                                : (colResponse.data.response || []);
                            // Find the default collection (isDefault flag set by backend)
                            const defaultCol = collections.find((c: any) => c.isDefault === true)
                                || collections.find((c: any) => c.name === loadedConfig.defaultCollection);
                            if (defaultCol) {
                                defaultCollection = {
                                    name: defaultCol.name,
                                    id: defaultCol.id,
                                    ownerId: defaultCol.ownerId
                                };
                            }
                        }
                    }
                }
            } catch (err) {

            }

            form.setValue('collection', defaultCollection as any);

            // Load preferences
            const hostname = getHostname(tabInfo.url);
            getEffectivePreferences(hostname).then((p) => {
                setPrefs(p);
                setLoadingPrefs(false);
            });

            // Extract OG image
            const ogMeta = document.querySelector('meta[property="og:image"]');
            if (ogMeta) {
                let ogUrl = ogMeta.getAttribute('content');
                if (ogUrl) {
                    if (!ogUrl.startsWith('http://') && !ogUrl.startsWith('https://')) {
                        const origin = window.location.origin;
                        ogUrl = origin + (ogUrl.startsWith('/') ? ogUrl : '/' + ogUrl);
                    }
                    setOgImageUrl(ogUrl);

                    processOgImage(ogUrl).then((blob) => {
                        if (blob) {
                            setPreProcessedThumbnail(blob);
                        }
                    }).catch(() => { });
                }
            }
        };
        init();
    }, [form]);

    const handleToggle = async (key: keyof ExtensionPreferences) => {
        const newValue = !prefs[key];
        const newPrefs = { ...prefs, [key]: newValue };
        setPrefs(newPrefs);

        if (key === 'enableSmartCapture' || key === 'enableSelectionMenu') {
            const hostname = getHostname(currentUrl);
            if (hostname) {
                await saveSiteOverride(hostname, key as keyof SiteOverride, newValue as boolean);
            }
        } else {
            await savePreferences(newPrefs);
        }
    };

    // Handle AI suggestion
    const handleSuggestTags = async () => {
        if (isSuggestingTags) return;
        setIsSuggestingTags(true);
        try {
            const title = form.getValues('name') || document.title || '';
            const description = form.getValues('description') || '';

            // @ts-ignore
            const response = await chrome.runtime.sendMessage({
                type: 'SUGGEST_TAGS',
                data: { url: currentUrl, title, description }
            });

            if (response.success && response.data?.tags?.length > 0) {
                const currentTags = form.getValues('tags') || [];
                const newTags = response.data.tags
                    .filter((tagName: string) => !currentTags.some(t => t.name === tagName))
                    .map((tagName: string) => ({ name: tagName }));

                if (newTags.length > 0) {
                    form.setValue('tags', [...currentTags, ...newTags]);
                    setAiAuthored(true);
                    toast({
                        title: 'AI Tags Added',
                        description: `Added ${newTags.length} suggested tag${newTags.length > 1 ? 's' : ''}`,
                    });
                } else {
                    setAiAuthored(true);
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

    // Queries
    const { data: collections, isLoading: loadingCollections } = useQuery({
        queryKey: ['collections'],
        queryFn: async () => {
            // @ts-ignore
            const response = await chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' });
            if (!response.success) throw new Error(response.error);
            return response.data.response.sort((a: any, b: any) =>
                (a.name || '').localeCompare(b.name || '')
            );
        },
    });

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

    const manualTaggingRef = useRef(false);
    const manualAiToggleRef = useRef(false);
    const watchedTags = form.watch('tags');

    // Archive Tag Logic
    useEffect(() => {
        const archivalTags = watchedTags?.filter((t: any) =>
            t.archiveAsScreenshot ||
            t.archiveAsMonolith ||
            t.archiveAsPDF ||
            t.archiveAsReadable ||
            t.archiveAsWaybackMachine ||
            t.aiTag
        ) || [];

        if (archivalTags.length > 0) {
            setArchiveOptions({
                archiveAsScreenshot: archivalTags.some((t: any) => t.archiveAsScreenshot),
                archiveAsMonolith: archivalTags.some((t: any) => t.archiveAsMonolith),
                archiveAsPDF: archivalTags.some((t: any) => t.archiveAsPDF),
                archiveAsReadable: archivalTags.some((t: any) => t.archiveAsReadable),
                aiTag: archivalTags.some((t: any) => t.aiTag),
            });
        } else {
            if (userProfile) {
                setArchiveOptions(prev => {
                    const currentAiTag = prev?.aiTag ?? false;
                    return {
                        archiveAsScreenshot: userProfile.archiveAsScreenshot ?? true,
                        archiveAsMonolith: userProfile.archiveAsMonolith ?? true,
                        archiveAsPDF: userProfile.archiveAsPDF ?? true,
                        archiveAsReadable: userProfile.archiveAsReadable ?? true,
                        // If user manually touched tags or toggle, preserve logic
                        aiTag: (manualTaggingRef.current || manualAiToggleRef.current) ? currentAiTag : (userProfile.aiTaggingMethod !== 'DISABLED' && userProfile.aiTaggingMethod !== undefined),
                    };
                });
            }
        }
    }, [watchedTags, tags, userProfile]);

    useEffect(() => {
        return () => {
            if (successTimeoutRef.current) {
                clearTimeout(successTimeoutRef.current);
            }
        };
    }, []);

    // Save Mutation
    const { mutate: handleSave, isLoading: isSaving } = useMutation({
        mutationFn: async (action: 'edit' | 'open') => {
            const values = form.getValues();
            const cleanUrl = values.url || currentUrl;

            const payload = {
                ...values,
                url: cleanUrl,
                collection: {
                    name: values.collection?.name,
                    id: values.collection?.id,
                    ownerId: values.collection?.ownerId
                },
                tags: (values.tags || []).map((t) => ({ name: t.name })),
                preservationConfig: archiveOptions || {
                    archiveAsScreenshot: true,
                    archiveAsMonolith: true,
                    archiveAsPDF: true,
                    archiveAsReadable: true,
                    aiTag: false
                },
                uploadImage: uploadScreenshot,
            };

            const response = await chrome.runtime.sendMessage({
                type: 'SAVE_LINK_FROM_EXTENSION',
                data: {
                    uploadImage: uploadScreenshot,
                    values: payload,
                    aiTagged: aiAuthored,
                }
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
                processOgImage(ogImageUrl).then(async (blob) => {
                    if (blob) await saveThumbnail(currentUrl, blob);
                }).catch(() => { });
            }

            const fullCollection = collections?.find((c: any) => c.id === values.collection?.id) || values.collection;
            const collectionWithFlag = { ...fullCollection, _expectAiTags: archiveOptions?.aiTag ?? false };
            const enrichedLink = {
                ...link,
                collection: { ...link?.collection, ...collectionWithFlag },
                _optimisticThumbnail: optimisticThumbnailUrl,
                _expectAiTags: archiveOptions?.aiTag ?? false,
            };

            try {
                const prefKey = `link_ai_pref_${link.id}`;
                sessionStorage.setItem(prefKey, JSON.stringify({
                    expectAi: archiveOptions?.aiTag ?? false,
                    timestamp: Date.now()
                }));
            } catch (e) {

            }

            const hostname = getHostname(currentUrl);
            if (hostname) {
                getSiteOverrides().then(async (overrides) => {
                    const clientOverride = overrides[hostname];
                    const valuesToSave = {
                        enableSmartCapture: clientOverride?.enableSmartCapture ?? prefs.enableSmartCapture,
                        enableSelectionMenu: clientOverride?.enableSelectionMenu ?? prefs.enableSelectionMenu
                    };

                    chrome.runtime.sendMessage({
                        type: 'SET_DOMAIN_PREFERENCE',
                        data: { domain: hostname, ...valuesToSave }
                    }, (response) => {
                        if (response?.success && clientOverride) {
                            clearSiteOverride(hostname, 'enableSmartCapture');
                            clearSiteOverride(hostname, 'enableSelectionMenu');
                        }
                    });
                }).catch(() => { });
            }

            if (action === 'open') {
                if (link?.id) {
                    getConfig().then(config => {
                        const dashboardUrl = `${config.baseUrl}/links/${link.id}`;
                        chrome.tabs.create({ url: dashboardUrl });
                        if (onClose) onClose();
                    });
                } else if (onSuccess) {
                    onSuccess(enrichedLink, false);
                }
            } else if (action === 'edit') {
                setSaveSuccess(true);
                if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
                successTimeoutRef.current = setTimeout(() => {
                    if (onSuccess) onSuccess(enrichedLink, false);
                }, 1000);
            }
        },
        onError: (err: any) => {

            toast({
                title: t('saveLink.error') || t('common.error'),
                description: err.message || t('editLink.saveFailed'),
                variant: 'destructive',
            });
        }
    });

    const formSubmit = async (e: any) => {
        e.preventDefault();
    }

    const faviconUrl = currentUrl ? `https://www.google.com/s2/favicons?sz=128&domain_url=${currentUrl}` : '';

    return (
        <div className="w-full relative">
            <div className="p-4">
                <SaveLinkHeader onClose={onClose} />

                {/* VOID Card Container wrapping both Preview and Form */}
                <div
                    className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                    style={{
                        background: `linear-gradient(135deg, ${(form.watch('collection') as any)?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)`,
                    }}
                >
                    <SaveLinkPreview
                        currentUrl={currentUrl}
                        faviconUrl={faviconUrl}
                        form={form}
                        initialTitle={initialTitle}
                        archiveOptions={archiveOptions}
                        setArchiveOptions={setArchiveOptions}
                        uploadScreenshot={uploadScreenshot}
                        setUploadScreenshot={setUploadScreenshot}
                        userProfile={userProfile}
                        manualAiToggleRef={manualAiToggleRef}
                    />

                    <SaveLinkForm
                        form={form}
                        formSubmit={formSubmit}
                        collections={collections}
                        loadingCollections={loadingCollections}
                        openCollections={openCollections}
                        setOpenCollections={setOpenCollections}
                        tags={tags || []}
                        loadingTags={loadingTags}
                        openTags={openTags}
                        setOpenTags={setOpenTags}
                        isDetailed={isDetailed}
                        setIsDetailed={setIsDetailed}
                        userProfile={userProfile}
                        isSuggestingTags={isSuggestingTags}
                        handleSuggestTags={handleSuggestTags}
                        manualTaggingRef={manualTaggingRef}
                        setArchiveOptions={setArchiveOptions}
                        containerRef={containerRef}
                    />
                </div>

                <SaveLinkPageInteractions
                    loadingPrefs={loadingPrefs}
                    prefs={prefs}
                    handleToggle={handleToggle}
                    setPrefs={setPrefs}
                />

                <SaveLinkFooter
                    onSave={() => {
                        if (uploadScreenshot) {
                            setShowCaptureConfirmation(true);
                        } else {
                            handleSave('edit');
                        }
                    }}
                    isSaving={isSaving}
                    saveSuccess={saveSuccess}
                    onPreferences={onPreferences}
                    openOptions={openOptions}
                />
            </div>

            <CaptureOverlays
                isSaving={isSaving}
                uploadScreenshot={uploadScreenshot}
                showCaptureConfirmation={showCaptureConfirmation}
                captureOverlayVisible={captureOverlayVisible}
                handleCloseCapture={handleCloseCapture}
                onStartCapture={() => {
                    handleCloseCapture();
                    if (onHideForCapture) {
                        onHideForCapture(() => handleSave('edit'));
                    } else {
                        handleSave('edit');
                    }
                }}
            />

            <Toaster />
        </div>
    );
};
