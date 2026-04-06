import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinkWithHighlights } from '../../@/lib/types/highlight.ts';
import { ThemeProvider } from '../../@/components/ThemeProvider.tsx';
import { ThemeDetector } from './SmartCapture/ThemeDetector.ts';
import { getExtensionBootstrapState } from '../../@/lib/actions/bootstrap.ts';
import { getLinkWithHighlights, syncUserLocale } from '../../@/lib/runtime/messages.ts';
import { readLinkSessionCache, writeLinkSessionCache } from '../../@/lib/runtime/sessionCache';
import { applyAccentColor } from '../../@/lib/accentColor.ts';

const LazySaveLinkCard = lazy(async () => ({
    default: (await import('../../@/components/SaveLinkCard.tsx')).SaveLinkCard,
}));
const LazyAlreadySavedView = lazy(async () => ({
    default: (await import('../../@/components/AlreadySavedView.tsx')).AlreadySavedView,
}));
const LazyEditLinkView = lazy(async () => ({
    default: (await import('../../@/components/EditLinkView.tsx')).EditLinkView,
}));
const LazyPreferencesView = lazy(async () => ({
    default: (await import('../../@/components/PreferencesView.tsx')).PreferencesView,
}));
const LazyModal = lazy(() => import('../../@/components/Modal.tsx'));

const queryClient = new QueryClient();
const embeddedThemeDetector = new ThemeDetector();

interface EmbeddedAppProps {
    onClose: () => void;
    initialTheme?: 'dark' | 'light' | 'system' | 'website';
    cachedUserTheme?: 'dark' | 'light';
}

function EmbeddedPanelFallback({ padded = true }: { padded?: boolean }) {
    return (
        <div className={padded ? 'flex justify-center py-8' : 'flex justify-center p-4'}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
        </div>
    );
}

function toastLinkToLinkWithHighlights(toastLink: any): LinkWithHighlights {
    return {
        id: toastLink.id,
        url: toastLink.url,
        name: toastLink.name,
        createdAt: toastLink.createdAt || new Date().toISOString(),
        collection: toastLink.collection ? {
            id: 0,
            name: toastLink.collection.name,
            color: toastLink.collection.color || '',
            icon: toastLink.collection.icon || '',
            parentId: null,
            ownerId: 0,
        } : null,
        highlights: [],
        description: '',
        type: 'url',
        collectionId: 0,
        tags: [],
        pinnedBy: [],
        _skipAiPolling: true,
    } as any;
}

function useEmbeddedEvents({ handleClose, setIsVisible, handleSuccess }: {
    handleClose: () => void;
    setIsVisible: (v: boolean) => void;
    handleSuccess: (linkData: any, openEdit?: boolean) => void;
}) {
    const [overrideLink, setOverrideLink] = useState<LinkWithHighlights | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const isUploadingRef = useRef(false);

    useEffect(() => {
        isUploadingRef.current = isUploading;
    }, [isUploading]);

    useEffect(() => {
        const onToggleClose = () => handleClose();

        const onOpenEdit = (event: CustomEvent) => {
            if (event.detail?.link) {
                setOverrideLink(toastLinkToLinkWithHighlights(event.detail.link));
            }
            setIsEditing(true);
            setIsVisible(true);
        };

        const onOpenSaved = (event: CustomEvent) => {
            if (event.detail?.link) {
                setOverrideLink(toastLinkToLinkWithHighlights(event.detail.link));
            }
            setIsEditing(false);
            setIsVisible(true);
        };

        const onMessage = (message: any) => {
            if (message.type === 'LINK_SAVE_PROGRESS' && message.status === 'uploading') {
                setIsUploading(true);
                isUploadingRef.current = true;
                setIsVisible(true);
            } else if (message.type === 'LINK_SAVE_SUCCESS') {
                const savedLink = message.data?.response || message.data;
                if (savedLink?.id) {
                    handleSuccess(savedLink);
                }
            }
        };

        window.addEventListener('grabshark-toggle-close', onToggleClose);
        window.addEventListener('grabshark-open-edit', onOpenEdit as EventListener);
        window.addEventListener('grabshark-open-saved', onOpenSaved as EventListener);
        chrome.runtime.onMessage.addListener(onMessage);

        return () => {
            window.removeEventListener('grabshark-toggle-close', onToggleClose);
            window.removeEventListener('grabshark-open-edit', onOpenEdit as EventListener);
            window.removeEventListener('grabshark-open-saved', onOpenSaved as EventListener);
            chrome.runtime.onMessage.removeListener(onMessage);
        };
    }, [handleClose, setIsVisible, handleSuccess]);

    return { overrideLink, setOverrideLink, isEditing, setIsEditing, isUploading, setIsUploading, isUploadingRef };
}

const EmbeddedAppContent = ({ initialTheme, cachedUserTheme, containerRef, setContainerRef, isVisible, setIsVisible, handleClose, handleThemeLoaded }: any) => {
    const currentUrl = window.location.href;
    const currentHostname = window.location.hostname;
    const qc = useQueryClient();
    const [isAllConfigured, setIsAllConfigured] = useState<boolean>();
    const [sharedImgSrc, setSharedImgSrc] = useState<string>('');
    const [hasOpened, setHasOpened] = useState(false);
    const [isViewingPreferences, setIsViewingPreferences] = useState(false);
    const [_preferencesOrigin, setPreferencesOrigin] = useState<'save' | 'saved' | null>(null);
    const [userProfile, setUserProfile] = useState<any | null>(null);
    const [loadingBootstrap, setLoadingBootstrap] = useState(true);

    const [cachedLink] = useState<LinkWithHighlights | null>(() => readLinkSessionCache<LinkWithHighlights>(currentUrl));

    useEffect(() => {
        let active = true;

        const loadBootstrap = async () => {
            try {
                const bootstrap = await getExtensionBootstrapState(currentHostname);
                if (!active) return;
                setIsAllConfigured(bootstrap.configured);
                setUserProfile(bootstrap.user || null);
                if (bootstrap.user?.accentColor) {
                    chrome.storage.local.set({ grabshark_accent_color: bootstrap.user.accentColor });
                }
            } catch {
                if (!active) return;
                setIsAllConfigured(false);
                setUserProfile(null);
            } finally {
                if (active) setLoadingBootstrap(false);
            }
        };

        void loadBootstrap();
        return () => {
            active = false;
        };
    }, [currentHostname]);

    const { data: savedLink, isLoading: isLinkLoading } = useQuery({
        queryKey: ['link', currentUrl],
        queryFn: async () => {
            if (!isAllConfigured) return null;
            try {
                const response = await getLinkWithHighlights(currentUrl);
                if (response?.link) {
                    writeLinkSessionCache(currentUrl, response.link);
                    return response.link as LinkWithHighlights;
                }
            } catch {
                // noop
            }
            return null;
        },
        enabled: isAllConfigured === true,
        initialData: cachedLink || undefined,
        staleTime: 1000 * 60 * 5,
    });

    useEffect(() => {
        if (isVisible) {
            setHasOpened(true);
            void syncUserLocale().catch(() => { });
        }
    }, [isVisible]);

    useEffect(() => {
        if (userProfile?.accentColor && containerRef) {
            const isDark = containerRef.classList.contains('dark');
            applyAccentColor(userProfile.accentColor, isDark, containerRef);
        }
    }, [userProfile?.accentColor, containerRef]);

    const loading = loadingBootstrap || (isAllConfigured === true && !cachedLink && isLinkLoading);

    const resolveTheme = useCallback((theme: string): 'dark' | 'light' | undefined => {
        if (theme === 'website') return embeddedThemeDetector.isDarkMode() ? 'dark' : 'light';
        if (theme === 'system') {
            const resolvedTheme = userProfile?.theme || cachedUserTheme;
            if (resolvedTheme === 'light' || resolvedTheme === 'dark') return resolvedTheme;
        }
        return undefined;
    }, [userProfile, cachedUserTheme]);

    const transitionView = useCallback((callback: () => void) => {
        setIsVisible(false);
        setTimeout(() => {
            callback();
            requestAnimationFrame(() => setIsVisible(true));
        }, 300);
    }, [setIsVisible]);

    const successHandlerRef = useRef<(linkData: any, openEdit?: boolean) => void>(() => { });

    const { overrideLink, setOverrideLink, isEditing, setIsEditing, isUploading, setIsUploading, isUploadingRef } =
        useEmbeddedEvents({
            handleClose,
            setIsVisible,
            handleSuccess: (linkData, openEdit) => successHandlerRef.current(linkData, openEdit),
        });

    successHandlerRef.current = (linkData: any, openEdit = false) => {
        qc.setQueryData(['link', currentUrl], linkData);
        writeLinkSessionCache(currentUrl, linkData);
        window.dispatchEvent(new CustomEvent('grabshark-link-saved', {
            detail: { link: linkData, url: currentUrl }
        }));

        if (isUploadingRef.current || isUploading) {
            setIsUploading(false);
            setIsEditing(openEdit);
            setIsVisible(true);
            return;
        }

        if (savedLink && savedLink.id === linkData.id && isEditing === openEdit) {
            return;
        }

        transitionView(() => setIsEditing(openEdit));
    };

    const handleHideForCapture = useCallback((callback: () => void) => {
        setIsVisible(false);
        setTimeout(callback, 350);
    }, [setIsVisible]);

    const handleLinkUpdate = (updatedLink: Partial<LinkWithHighlights>) => {
        qc.setQueryData(['link', currentUrl], (old: LinkWithHighlights | undefined) => old ? { ...old, ...updatedLink } : undefined);
    };

    const startTheme = (initialTheme === 'system' && cachedUserTheme) ? cachedUserTheme : initialTheme;
    const effectiveLink = overrideLink || savedLink;

    const renderConfiguredView = () => {
        if (isViewingPreferences) {
            return (
                <Suspense fallback={<EmbeddedPanelFallback />}>
                    <LazyPreferencesView
                        onClose={handleClose}
                        onBack={() => transitionView(() => setIsViewingPreferences(false))}
                    />
                </Suspense>
            );
        }

        if (effectiveLink || isUploading) {
            if (isEditing) {
                return (
                    <Suspense fallback={<EmbeddedPanelFallback />}>
                        <div className="p-4">
                            <LazyEditLinkView
                                link={effectiveLink!}
                                onClose={handleClose}
                                onBack={() => transitionView(() => setIsEditing(false))}
                                containerRef={containerRef}
                                onUpdate={handleLinkUpdate}
                                sharedImgSrc={sharedImgSrc}
                                onImgSrcChange={setSharedImgSrc}
                                onDelete={() => {
                                    qc.removeQueries(['link', currentUrl]);
                                    qc.setQueryData(['link', currentUrl], null);
                                    setOverrideLink(null);
                                    transitionView(() => setIsEditing(false));
                                }}
                            />
                        </div>
                    </Suspense>
                );
            }

            return (
                <Suspense fallback={<EmbeddedPanelFallback />}>
                    <LazyAlreadySavedView
                        key={effectiveLink ? JSON.stringify(effectiveLink) : 'empty'}
                        link={effectiveLink}
                        onEdit={(freshLink) => {
                            if (freshLink && currentUrl) qc.setQueryData(['link', currentUrl], freshLink);
                            transitionView(() => setIsEditing(true));
                        }}
                        sharedImgSrc={sharedImgSrc}
                        onImgSrcChange={setSharedImgSrc}
                        onClose={handleClose}
                        isUploading={isUploading}
                        onPreferences={() => {
                            setPreferencesOrigin('saved');
                            transitionView(() => setIsViewingPreferences(true));
                        }}
                    />
                </Suspense>
            );
        }

        return (
            <Suspense fallback={<EmbeddedPanelFallback />}>
                <div style={{ display: (effectiveLink || isUploading) ? 'none' : 'block' }}>
                    <LazySaveLinkCard
                        onClose={handleClose}
                        onSuccess={(linkData, openEdit) => successHandlerRef.current(linkData, openEdit)}
                        onHideForCapture={handleHideForCapture}
                        onPreferences={() => {
                            setPreferencesOrigin('save');
                            transitionView(() => setIsViewingPreferences(true));
                        }}
                        containerRef={containerRef}
                    />
                </div>
            </Suspense>
        );
    };

    return (
        <ThemeProvider
            defaultToRoot={false}
            rootElement={containerRef}
            resolveTheme={resolveTheme}
            onThemeLoaded={handleThemeLoaded}
            defaultTheme={startTheme}
            storageLoaded={!!initialTheme}
        >
            <div ref={setContainerRef} className="bg-void-bg p-1.5 rounded-[28px] shadow-2xl dark:shadow-black/60 shadow-black/10">
                <div className="bg-void-island/40 backdrop-blur-xl w-[350px] rounded-[24px] border border-void-border/10 font-sans text-left">
                    <div>
                        {hasOpened && (
                            loading ? (
                                <EmbeddedPanelFallback />
                            ) : isAllConfigured ? (
                                renderConfiguredView()
                            ) : (
                                <Suspense fallback={<EmbeddedPanelFallback />}>
                                    <LazyModal
                                        open={!isAllConfigured}
                                        onDone={() => {
                                            setIsVisible(false);
                                            setTimeout(() => {
                                                setIsAllConfigured(true);
                                                qc.invalidateQueries(['link', currentUrl]);
                                            }, 300);
                                            setTimeout(() => setIsVisible(true), 400);
                                        }}
                                    />
                                </Suspense>
                            )
                        )}
                    </div>
                </div>
            </div>
        </ThemeProvider>
    );
};

export const EmbeddedApp = ({ onClose, initialTheme, cachedUserTheme }: EmbeddedAppProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
    const closeTimeoutRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (closeTimeoutRef.current !== null) {
            window.clearTimeout(closeTimeoutRef.current);
        }
    }, []);

    const handleClose = useCallback(() => {
        if (!isVisible) return;
        if (closeTimeoutRef.current !== null) {
            window.clearTimeout(closeTimeoutRef.current);
        }
        setIsVisible(false);
        closeTimeoutRef.current = window.setTimeout(onClose, 300);
    }, [onClose, isVisible]);
    const handleThemeLoaded = useCallback(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setIsVisible(true));
        });
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <div
                className={`fixed top-[10px] right-[10px] z-[999999] transition-all duration-300 ease-out transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
                onWheel={(e) => e.stopPropagation()}
            >
                <EmbeddedAppContent
                    initialTheme={initialTheme}
                    cachedUserTheme={cachedUserTheme}
                    containerRef={containerRef}
                    setContainerRef={setContainerRef}
                    isVisible={isVisible}
                    setIsVisible={setIsVisible}
                    handleClose={handleClose}
                    handleThemeLoaded={handleThemeLoaded}
                />
            </div>
        </QueryClientProvider>
    );
};







