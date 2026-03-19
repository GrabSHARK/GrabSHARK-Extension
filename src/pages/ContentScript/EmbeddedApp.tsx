import { useCallback, useEffect, useRef, useState } from 'react';
import { SaveLinkCard } from '../../@/components/SaveLinkCard.tsx';
import { getStorageItem, setStorageItem } from '../../@/lib/utils.ts';
import { isConfigured } from '../../@/lib/config.ts';
import Modal from '../../@/components/Modal.tsx';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinkWithHighlights } from '../../@/lib/types/highlight.ts';
import { AlreadySavedView } from '../../@/components/AlreadySavedView.tsx';
import { ThemeProvider } from '../../@/components/ThemeProvider.tsx';
import { ThemeDetector } from './SmartCapture/ThemeDetector.ts';
import { EditLinkView } from '../../@/components/EditLinkView.tsx';
import { PreferencesView } from '../../@/components/PreferencesView.tsx';
import { getCurrentUser } from '../../@/lib/actions/users.ts';
import { getConfig } from '../../@/lib/config.ts';

const queryClient = new QueryClient();

interface EmbeddedAppProps {
    onClose: () => void;
    initialTheme?: "dark" | "light" | "system" | "website";
    cachedUserTheme?: "dark" | "light";
}

// --- Embedded Events (inlined from useEmbeddedEvents) ---

/** Convert toast link data to LinkWithHighlights format */
function toastLinkToLinkWithHighlights(toastLink: any): LinkWithHighlights {
    return {
        id: toastLink.id,
        url: toastLink.url,
        name: toastLink.name,
        createdAt: toastLink.createdAt || new Date().toISOString(),
        collection: toastLink.collection ? {
            id: 0, name: toastLink.collection.name,
            color: toastLink.collection.color || '', icon: toastLink.collection.icon || '',
            parentId: null, ownerId: 0,
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

    useEffect(() => { isUploadingRef.current = isUploading; }, [isUploading]);

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
                handleSuccess(message.data);
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
    }, [handleClose, setIsVisible, isUploadingRef]);

    return { overrideLink, setOverrideLink, isEditing, setIsEditing, isUploading, setIsUploading, isUploadingRef };
}

// --- EmbeddedApp Content ---

const EmbeddedAppContent = ({ initialTheme, cachedUserTheme, containerRef, setContainerRef, isVisible, setIsVisible, handleClose, handleThemeLoaded }: any) => {
    const currentUrl = window.location.href;
    const qc = useQueryClient();
    const [isAllConfigured, setIsAllConfigured] = useState<boolean>();
    const [sharedImgSrc, setSharedImgSrc] = useState<string>('');
    const [hasOpened, setHasOpened] = useState(false);
    const [isViewingPreferences, setIsViewingPreferences] = useState(false);
    const [_preferencesOrigin, setPreferencesOrigin] = useState<'save' | 'saved' | null>(null);

    // Optimistic cache read
    const [cachedLink] = useState<LinkWithHighlights | null>(() => {
        try { const c = sessionStorage.getItem(`lw_cache_${currentUrl}`); return c ? JSON.parse(c).link : null; } catch { return null; }
    });
    const [loading, setLoading] = useState(!cachedLink);

    const { data: savedLink } = useQuery({
        queryKey: ['link', currentUrl],
        queryFn: async () => {
            if (!(await isConfigured())) return null;
            try {
                const r = await chrome.runtime.sendMessage({ type: 'GET_LINK_WITH_HIGHLIGHTS', data: { url: currentUrl } });
                if (r.success && r.data?.link) { try { sessionStorage.setItem(`lw_cache_${currentUrl}`, JSON.stringify({ timestamp: Date.now(), link: r.data.link })); } catch { } return r.data.link as LinkWithHighlights; }
            } catch { }
            return null;
        },
        initialData: cachedLink || undefined,
        staleTime: 1000 * 60 * 5,
    });

    useEffect(() => { (async () => { setIsAllConfigured(await isConfigured()); setLoading(false); })(); }, []);
    useEffect(() => { if (isVisible) { setHasOpened(true); chrome.runtime.sendMessage({ type: 'SYNC_USER_LOCALE' }).catch(() => { }); } }, [isVisible]);

    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);
    useEffect(() => { getConfig().then(c => { setBaseUrl(c.baseUrl); setApiKey(c.apiKey); }); }, []);

    const { data: userProfile } = useQuery({
        queryKey: ['userProfile'],
        queryFn: () => apiKey && baseUrl ? getCurrentUser(baseUrl, apiKey) : Promise.reject('No config'),
        enabled: !!apiKey && !!baseUrl, retry: 1, staleTime: 0,
    });

    const resolveTheme = useCallback((theme: string): "dark" | "light" | undefined => {
        if (theme === 'website') return new ThemeDetector().isDarkMode() ? 'dark' : 'light';
        if (theme === 'system') { const t = userProfile?.theme || cachedUserTheme; if (t === 'light' || t === 'dark') return t; }
        return undefined;
    }, [userProfile, cachedUserTheme]);

    useEffect(() => {
        if (userProfile?.theme) {
            getStorageItem('cached_user_prefs').then((existing: any) => {
                const p = existing || {};
                if (p.theme !== userProfile.theme) setStorageItem('cached_user_prefs', { ...p, theme: userProfile.theme });
            });
        }
    }, [userProfile]);

    const transitionView = (callback: () => void) => {
        setIsVisible(false);
        setTimeout(() => { callback(); requestAnimationFrame(() => setIsVisible(true)); }, 300);
    };

    const handleSuccess = (linkData: any, openEdit = false) => {
        qc.setQueryData(['link', currentUrl], linkData);
        if (isUploadingRef.current || isUploading) { setIsUploading(false); setIsEditing(openEdit); setIsVisible(true); }
        else { if (savedLink && savedLink.id === linkData.id && isEditing === openEdit) return; transitionView(() => setIsEditing(openEdit)); }
    };

    const { overrideLink, setOverrideLink, isEditing, setIsEditing, isUploading, setIsUploading, isUploadingRef } =
        useEmbeddedEvents({ handleClose, setIsVisible, handleSuccess });

    const handleHideForCapture = useCallback((callback: () => void) => { setIsVisible(false); setTimeout(callback, 350); }, [setIsVisible]);
    const handleLinkUpdate = (updatedLink: Partial<LinkWithHighlights>) => {
        qc.setQueryData(['link', currentUrl], (old: LinkWithHighlights | undefined) => old ? { ...old, ...updatedLink } : undefined);
    };

    const startTheme = (initialTheme === 'system' && cachedUserTheme) ? cachedUserTheme : initialTheme;

    return (
        <ThemeProvider defaultToRoot={false} rootElement={containerRef} resolveTheme={resolveTheme} onThemeLoaded={handleThemeLoaded} defaultTheme={startTheme} storageLoaded={!!initialTheme}>
            <div ref={setContainerRef} className="bg-void-bg p-1.5 rounded-[28px] shadow-2xl dark:shadow-black/60 shadow-black/10">
                <div className="bg-void-island/40 backdrop-blur-xl w-[350px] rounded-[24px] border border-void-border/10 font-sans text-left">
                    <div>
                        {hasOpened && (<>
                            {loading ? (
                                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div></div>
                            ) : (<>
                                {isAllConfigured && (<>
                                    {isViewingPreferences ? (
                                        <PreferencesView onClose={handleClose} onBack={() => transitionView(() => setIsViewingPreferences(false))} />
                                    ) : (<>
                                        {(() => {
                                            const effectiveLink = overrideLink || savedLink;
                                            return (effectiveLink || isUploading) ? (<>
                                                {isEditing ? (
                                                    <div className="p-4">
                                                        <EditLinkView link={effectiveLink!} onClose={handleClose}
                                                            onBack={() => transitionView(() => setIsEditing(false))}
                                                            containerRef={containerRef} onUpdate={handleLinkUpdate}
                                                            sharedImgSrc={sharedImgSrc} onImgSrcChange={setSharedImgSrc}
                                                            onDelete={() => { qc.removeQueries(['link', currentUrl]); qc.setQueryData(['link', currentUrl], null); setOverrideLink(null); transitionView(() => setIsEditing(false)); }} />
                                                    </div>
                                                ) : (
                                                    <AlreadySavedView key={effectiveLink ? JSON.stringify(effectiveLink) : 'empty'}
                                                        link={effectiveLink} onEdit={(freshLink) => { if (freshLink && currentUrl) qc.setQueryData(['link', currentUrl], freshLink); transitionView(() => setIsEditing(true)); }}
                                                        sharedImgSrc={sharedImgSrc} onImgSrcChange={setSharedImgSrc} onClose={handleClose} isUploading={isUploading}
                                                        onPreferences={() => { setPreferencesOrigin('saved'); transitionView(() => setIsViewingPreferences(true)); }} />
                                                )}
                                            </>) : (
                                                <div style={{ display: (effectiveLink || isUploading) ? 'none' : 'block' }}>
                                                    <SaveLinkCard onClose={handleClose} onSuccess={handleSuccess} onHideForCapture={handleHideForCapture}
                                                        onPreferences={() => { setPreferencesOrigin('save'); transitionView(() => setIsViewingPreferences(true)); }} containerRef={containerRef} />
                                                </div>
                                            );
                                        })()}
                                    </>)}
                                </>)}
                            </>)}
                        </>)}
                        <Modal open={!isAllConfigured} onDone={() => {
                            setIsVisible(false);
                            setTimeout(() => { setIsAllConfigured(true); qc.invalidateQueries(['link', currentUrl]); }, 300);
                            setTimeout(() => setIsVisible(true), 400);
                        }} />
                    </div>
                </div>
            </div>
        </ThemeProvider>
    );
};

export const EmbeddedApp = ({ onClose, initialTheme, cachedUserTheme }: EmbeddedAppProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
    const handleClose = useCallback(() => { if (!isVisible) return; setIsVisible(false); setTimeout(onClose, 300); }, [onClose, isVisible]);
    const handleThemeLoaded = useCallback(() => { requestAnimationFrame(() => { requestAnimationFrame(() => setIsVisible(true)); }); }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <div className={`fixed top-[10px] right-[10px] z-[999999] transition-all duration-300 ease-out transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
                onWheel={(e) => e.stopPropagation()}>
                <EmbeddedAppContent initialTheme={initialTheme} cachedUserTheme={cachedUserTheme} containerRef={containerRef}
                    setContainerRef={setContainerRef} isVisible={isVisible} setIsVisible={setIsVisible} handleClose={handleClose} handleThemeLoaded={handleThemeLoaded} />
            </div>
        </QueryClientProvider>
    );
};
