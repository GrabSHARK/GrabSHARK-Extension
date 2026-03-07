import { useCallback, useEffect, useState, useRef } from 'react';
import { SaveLinkCard } from '../../@/components/SaveLinkCard.tsx';
import { getStorageItem, setStorageItem } from '../../@/lib/utils.ts';
import { isConfigured } from '../../@/lib/config.ts';
import Modal from '../../@/components/Modal.tsx';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
// import '../Popup/index.css';
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

// Separate component to use useQueryClient hook or access queryClient
const EmbeddedAppContent = ({ initialTheme, cachedUserTheme, containerRef, setContainerRef, isVisible, setIsVisible, handleClose, handleThemeLoaded }: any) => {
    const currentUrl = window.location.href;
    const queryClient = useQueryClient();

    const [isAllConfigured, setIsAllConfigured] = useState<boolean>();
    const [isEditing, setIsEditing] = useState(false);
    const [sharedImgSrc, setSharedImgSrc] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const isUploadingRef = useRef(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [isViewingPreferences, setIsViewingPreferences] = useState(false);
    // Track where preferences was opened from: 'save' | 'saved' | null
    const [_preferencesOrigin, setPreferencesOrigin] = useState<'save' | 'saved' | null>(null);




    // Optimistic Cache Read
    const [cachedLink] = useState<LinkWithHighlights | null>(() => {
        try {
            const cacheKey = `lw_cache_${currentUrl}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                return parsed.link;
            }
        } catch (e) { }
        return null;
    });

    const [loading, setLoading] = useState(!cachedLink);

    // Unified State: Use React Query with Optimistic Initial Data
    const { data: savedLink } = useQuery({
        queryKey: ['link', currentUrl],
        queryFn: async () => {
            const cachedOptions = await isConfigured();
            if (!cachedOptions) return null;

            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'GET_LINK_WITH_HIGHLIGHTS',
                    data: { url: currentUrl }
                });
                if (response.success && response.data?.link) {
                    // Update cache on fresh fetch
                    try {
                        sessionStorage.setItem(`lw_cache_${currentUrl}`, JSON.stringify({
                            timestamp: Date.now(),
                            link: response.data.link
                        }));
                    } catch (e) { }
                    return response.data.link as LinkWithHighlights;
                }
            } catch (e) {

            }
            return null;
        },
        initialData: cachedLink || undefined, // Use cache if available!
        staleTime: 1000 * 60 * 5,
    });

    // Check configuration
    useEffect(() => {
        (async () => {
            const cachedOptions = await isConfigured();
            setIsAllConfigured(cachedOptions);
            setLoading(false);
        })();
    }, []);

    // Sync ref
    useEffect(() => {
        isUploadingRef.current = isUploading;
    }, [isUploading]);

    // Track open state
    useEffect(() => {
        if (isVisible) {
            setHasOpened(true);
            chrome.runtime.sendMessage({ type: 'SYNC_USER_LOCALE' }).catch(() => { });
        }
    }, [isVisible]);

    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);

    useEffect(() => {
        getConfig().then((config) => {
            setBaseUrl(config.baseUrl);
            setApiKey(config.apiKey);
        });
    }, []);

    const { data: userProfile } = useQuery({
        queryKey: ['userProfile'],
        queryFn: () => apiKey && baseUrl ? getCurrentUser(baseUrl, apiKey) : Promise.reject('No config'),
        enabled: !!apiKey && !!baseUrl,
        retry: 1,
        staleTime: 0, // Always re-validate for instant theme sync
    });

    const resolveTheme = useCallback((theme: string): "dark" | "light" | undefined => {
        if (theme === 'website') {
            const detector = new ThemeDetector();
            return detector.isDarkMode() ? 'dark' : 'light';
        }

        // Handle "Follow SPARK" (mapped to 'system' in ModeToggle)
        if (theme === 'system') {
            const profileTheme = userProfile?.theme || cachedUserTheme;
            if (profileTheme === 'light') return 'light';
            if (profileTheme === 'dark') return 'dark';
        }



        return undefined;
    }, [userProfile, cachedUserTheme]);

    // Self-Healing Cache: Update storage when we fetch distinct user profile
    useEffect(() => {
        if (userProfile?.theme) {
            getStorageItem('cached_user_prefs').then((existing: any) => {
                const prefs = existing || {};
                if (prefs.theme !== userProfile.theme) {
                    setStorageItem('cached_user_prefs', { ...prefs, theme: userProfile.theme });
                }
            });
        }
    }, [userProfile]);

    // Override link from Toast - when user clicks Edit/Show on a toast card
    const [overrideLink, setOverrideLink] = useState<LinkWithHighlights | null>(null);

    // Listen for toggle close event from content script (when user clicks extension icon again)
    useEffect(() => {
        const onToggleClose = () => {
            handleClose();
        };

        // Toast Edit button clicked - open embedded app with edit view
        const onOpenEdit = (event: CustomEvent) => {

            if (event.detail?.link) {
                // Convert ToastLinkData to LinkWithHighlights format
                const toastLink = event.detail.link;
                setOverrideLink({
                    id: toastLink.id,
                    url: toastLink.url,
                    name: toastLink.name,
                    createdAt: toastLink.createdAt || new Date().toISOString(),
                    collection: toastLink.collection ? {
                        id: 0, // Will be fetched
                        name: toastLink.collection.name,
                        color: toastLink.collection.color || '',
                        icon: toastLink.collection.icon || '',
                        parentId: null,
                        ownerId: 0,
                    } : null,
                    highlights: [],
                    // Minimal required fields
                    description: '',
                    type: 'url',
                    collectionId: 0,
                    tags: [],
                    pinnedBy: [],
                    // Flag to skip AI polling - Toast links are already saved
                    _skipAiPolling: true,
                } as any);
            }
            setIsEditing(true);
            setIsVisible(true);
        };

        // Toast Show button clicked - open embedded app with saved view  
        const onOpenSaved = (event: CustomEvent) => {

            if (event.detail?.link) {
                const toastLink = event.detail.link;
                setOverrideLink({
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
                    // Flag to skip AI polling - Toast links are already saved
                    _skipAiPolling: true,
                } as any);
            }
            setIsEditing(false);
            setIsVisible(true);
        };

        const onMessage = (message: any) => {
            if (message.type === 'LINK_SAVE_PROGRESS' && message.status === 'uploading') {
                setIsUploading(true);
                isUploadingRef.current = true; // Sync ref immediately
                setIsVisible(true);
            } else if (message.type === 'LINK_SAVE_SUCCESS') {
                handleSuccess(message.data);
            }
        };

        window.addEventListener('spark-toggle-close', onToggleClose);
        window.addEventListener('spark-open-edit', onOpenEdit as EventListener);
        window.addEventListener('spark-open-saved', onOpenSaved as EventListener);
        chrome.runtime.onMessage.addListener(onMessage);

        return () => {
            window.removeEventListener('spark-toggle-close', onToggleClose);
            window.removeEventListener('spark-open-edit', onOpenEdit as EventListener);
            window.removeEventListener('spark-open-saved', onOpenSaved as EventListener);
            chrome.runtime.onMessage.removeListener(onMessage);
        };
    }, [handleClose, setIsVisible, isUploadingRef]);

    const transitionView = (callback: () => void) => {
        setIsVisible(false); // Animate out
        setTimeout(() => {
            callback();      // Change state (Edit/Saved)
            requestAnimationFrame(() => {
                setIsVisible(true); // Animate in
            });
        }, 300);
    };

    const handleSuccess = (linkData: any, openEdit = false) => {
        // Here we UNIFY the state: Update the query cache directly
        queryClient.setQueryData(['link', currentUrl], linkData);

        if (isUploadingRef.current || isUploading) {
            setIsUploading(false);
            setIsEditing(openEdit);
            setIsVisible(true);
        } else {
            // Check if we are already showing this link
            if (savedLink && savedLink.id === linkData.id && isEditing === openEdit) {
                return;
            }
            // Transition
            transitionView(() => {
                setIsEditing(openEdit);
            });
        }
    };

    const handleHideForCapture = useCallback((callback: () => void) => {
        setIsVisible(false);
        setTimeout(() => {
            callback();
        }, 350);
    }, [setIsVisible]);

    // Handle updates from EditLinkView
    const handleLinkUpdate = (updatedLink: Partial<LinkWithHighlights>) => {
        queryClient.setQueryData(['link', currentUrl], (old: LinkWithHighlights | undefined) => {
            if (!old) return undefined;
            return { ...old, ...updatedLink };
        });
    };



    // Calculate effective initial theme to prevent flash
    // If we have a cached user theme and the setting is 'system', start with the cached value
    const startTheme = (initialTheme === 'system' && cachedUserTheme) ? cachedUserTheme : initialTheme;

    return (
        <ThemeProvider defaultToRoot={false} rootElement={containerRef} resolveTheme={resolveTheme} onThemeLoaded={handleThemeLoaded} defaultTheme={startTheme} storageLoaded={!!initialTheme}>
            <div ref={setContainerRef} className="bg-void-bg p-1.5 rounded-[28px] shadow-2xl dark:shadow-black/60 shadow-black/10">
                <div className="bg-void-island/40 backdrop-blur-xl w-[350px] rounded-[24px] border border-void-border/10 font-sans text-left">
                    <div>
                        {/* Header - Only show for New Link form, AlreadySavedView has its own minimal header implicitly via the card */}
                        {/* Header - Removed as SaveLinkCard handles its own header now */}


                        {/* Content */}
                        {hasOpened && (
                            <>
                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Only render SaveCard/AlreadySavedView after Modal is done */}
                                        {isAllConfigured && (
                                            <>
                                                {/* Show PreferencesView if viewing preferences */}
                                                {isViewingPreferences ? (
                                                    <PreferencesView
                                                        onClose={handleClose}
                                                        onBack={() => {
                                                            transitionView(() => setIsViewingPreferences(false));
                                                        }}
                                                    />
                                                ) : (
                                                    <>
                                                        {/* Use overrideLink from Toast if available, otherwise use savedLink */}
                                                        {(() => {
                                                            const effectiveLink = overrideLink || savedLink;
                                                            return (effectiveLink || isUploading) ? (
                                                                <>
                                                                    {isEditing ? (
                                                                        <div className="p-4">
                                                                            <EditLinkView
                                                                                link={effectiveLink!}
                                                                                onClose={handleClose}
                                                                                onBack={() => {
                                                                                    // Keep overrideLink so AlreadySavedView shows the correct link
                                                                                    transitionView(() => setIsEditing(false));
                                                                                }}
                                                                                containerRef={containerRef}
                                                                                onUpdate={handleLinkUpdate}
                                                                                sharedImgSrc={sharedImgSrc}
                                                                                onImgSrcChange={setSharedImgSrc}
                                                                                onDelete={() => {
                                                                                    // Clear cache immediately so UI resets to "Save" state
                                                                                    queryClient.removeQueries(['link', currentUrl]);
                                                                                    queryClient.setQueryData(['link', currentUrl], null);
                                                                                    setOverrideLink(null); // Clear override on delete
                                                                                    transitionView(() => setIsEditing(false));
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <AlreadySavedView
                                                                            key={effectiveLink ? JSON.stringify(effectiveLink) : 'empty'}
                                                                            link={effectiveLink}
                                                                            onEdit={(freshLink) => {
                                                                                // If we have fresh data (e.g. from polling tags), update cache before editing
                                                                                if (freshLink && currentUrl) {
                                                                                    queryClient.setQueryData(['link', currentUrl], freshLink);
                                                                                }
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
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div style={{ display: (effectiveLink || isUploading) ? 'none' : 'block' }}>
                                                                    <SaveLinkCard
                                                                        onClose={handleClose}
                                                                        onSuccess={handleSuccess}
                                                                        onHideForCapture={handleHideForCapture}
                                                                        onPreferences={() => {
                                                                            setPreferencesOrigin('save');
                                                                            transitionView(() => setIsViewingPreferences(true));
                                                                        }}
                                                                        containerRef={containerRef}
                                                                    />
                                                                </div>
                                                            );
                                                        })()}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        )}



                        <Modal
                            open={!isAllConfigured}
                            onDone={(_linkExists: boolean) => {
                                // Modal has already completed its own 300ms closing animation (isClosing)
                                // Now: 1) Slide out container, 2) Update state, 3) Slide in SaveCard
                                setIsVisible(false);
                                setTimeout(() => {
                                    setIsAllConfigured(true);
                                    queryClient.invalidateQueries(['link', currentUrl]);
                                }, 300); // Wait for slide-out
                                setTimeout(() => {
                                    setIsVisible(true);
                                }, 400); // Slide in after state updated
                            }}
                        />
                    </div>
                </div>
            </div>
        </ThemeProvider>
    );
};

export const EmbeddedApp = ({ onClose, initialTheme, cachedUserTheme }: EmbeddedAppProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);

    const handleClose = useCallback(() => {
        // If already closing or closed, do nothing
        if (!isVisible) return;

        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
    }, [onClose, isVisible]); // Added isVisible dependency

    // resolveTheme moved to content
    /* 
    const resolveTheme = useCallback((theme: string): "dark" | "light" | undefined => {
        if (theme === 'website') {
            const detector = new ThemeDetector();
            return detector.isDarkMode() ? 'dark' : 'light';
        }
        return undefined;
    }, []); 
    */

    const handleThemeLoaded = useCallback(() => {
        // Theme is applied (or at least loaded). Now trigger animation.
        // Use double RAF to ensure class is applied and painted before transitioning transform
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        });
    }, []);

    // Outer shell only handles Provider and mounting logic
    return (
        <QueryClientProvider client={queryClient}>
            {/* Outer Wrapper: Handles Positioning and Entrance Animation */}
            {/* React controls this className completely. ThemeProvider does NOT touch this. */}
            <div
                className={`fixed top-[10px] right-[10px] z-[999999] transition-all duration-300 ease-out transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
                    }`}
                onWheel={(e) => {
                    // Prevent scroll from propagating to the underlying page
                    e.stopPropagation();
                }}
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
