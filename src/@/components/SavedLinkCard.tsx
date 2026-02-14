import { useState, useEffect } from 'react';
import { LinkWithHighlights } from '../lib/types/highlight';
import { Check, FolderSimple, X } from '@phosphor-icons/react';
import { OutlineSparkleIcon } from './CustomIcons';
import Icon from './Icon';
import { format } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { getConfig } from '../lib/config';
import { useTranslation } from 'react-i18next';
import '../lib/i18n'; // Ensure init
import { getThumbnail } from '../lib/thumbnailCache';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../lib/actions/users';


interface SavedLinkCardProps {
    link: LinkWithHighlights;
    onEdit?: (link: LinkWithHighlights) => void;

    sharedImgSrc?: string;
    onImgSrcChange?: (src: string) => void;
    onClose?: () => void;
    // Callback to update parent state if we fetch fresh data (e.g. tags)
    onLinkUpdate?: (link: LinkWithHighlights) => void;
}

export const SavedLinkCard = ({ link: rawInitialLink, onEdit, sharedImgSrc, onImgSrcChange, onClose, onLinkUpdate }: SavedLinkCardProps) => {
    // Normalize incoming data - handle {response: {...}} wrapper from API
    const initialLink = (rawInitialLink as any)?.response || rawInitialLink;

    // Initialize with fallback to current page info if link data is incomplete
    const { t, i18n } = useTranslation();


    const [link, setLink] = useState<LinkWithHighlights>(() => ({
        ...initialLink,
        url: initialLink.url || window.location.href,
        name: initialLink.name || document.title || t('savedLink.untitled')
    }));

    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    // Priority: 1) Optimistic thumbnail from SaveLinkCard, 2) sharedImgSrc, 3) empty (will fetch)
    const optimisticThumbnail = (rawInitialLink as any)?._optimisticThumbnail;
    const [imgSrc, setImgSrc] = useState<string>(optimisticThumbnail || sharedImgSrc || '');
    const [isLoading, setIsLoading] = useState<boolean>(!optimisticThumbnail && !sharedImgSrc);

    // Helper to get favicon URL safely
    const getFaviconUrl = (url?: string) => {
        if (!url) return '';
        return `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;
    };

    const faviconUrl = getFaviconUrl(link.url);

    // Format date if available
    const formattedDate = link.createdAt
        ? format(new Date(link.createdAt), 'MMM d', { locale: i18n.language === 'tr' ? tr : enUS })
        : t('savedLink.justNow');

    const collectionName = link.collection?.name || 'Unorganized';
    const linkName = link.name; // Name is now guaranteed by state initialization
    // Polling state: poll if we expect AI tags but don't have them yet
    const [isPollingTags, setIsPollingTags] = useState(() => {
        // Skip polling if explicitly set (e.g., Toast links that are already saved)
        if ((initialLink as any)?._skipAiPolling) return false;

        const hasNoTags = !initialLink.tags || initialLink.tags.length === 0;
        if (!hasNoTags) return false; // Already have tags, no need to poll

        try {
            // 1. Check Session Storage (The Authority)
            const prefKey = `link_ai_pref_${initialLink.id}`;
            const stored = sessionStorage.getItem(prefKey);

            if (stored) {
                const { expectAi } = JSON.parse(stored);
                return expectAi === true; // Strictly obey storage
            }
        } catch (e) {

        }

        // 2. Fallback (Freshness) - Only if no storage record exists
        // AND the link was explicitly marked to expect AI tags
        const expectAiFlag = (initialLink as any)?._expectAiTags;
        if (expectAiFlag === true) {
            const createdAt = new Date(initialLink.createdAt || Date.now());
            const isFresh = (Date.now() - createdAt.getTime()) < 15000;
            return isFresh;
        }

        // Default: No polling if no explicit expectation
        return false;
    });

    // Update local state when prop changes
    // User requested simple sync on prop change
    useEffect(() => {
        setLink(prev => {
            // Merge collection: use initialLink as base (has required id), but preserve prev's icon/color if available
            const mergedCollection = initialLink?.collection ? {
                ...initialLink.collection,
                icon: prev.collection?.icon || initialLink.collection?.icon,
                color: prev.collection?.color || initialLink.collection?.color,
            } : prev.collection;

            // Update polling state if new link data comes in and has tags
            if (initialLink.tags && initialLink.tags.length > 0 && isPollingTags) {
                setIsPollingTags(false);
            }

            return {
                ...prev,
                ...initialLink,
                url: initialLink.url || prev.url || window.location.href,
                name: initialLink.name || prev.name || document.title || t('savedLink.untitled'),
                collection: mergedCollection,
            };
        });
    }, [initialLink]);

    // Polling Effect
    useEffect(() => {
        if (!isPollingTags || !link?.id) return;



        const intervalId = setInterval(async () => {
            try {
                // Fetch fresh link data
                const response = await chrome.runtime.sendMessage({
                    type: 'GET_LINK_WITH_HIGHLIGHTS',
                    data: { url: link.url }
                });

                if (response.success && response.data?.link) {
                    const freshLink = response.data.link;
                    // Check if tags have arrived
                    if (freshLink.tags && freshLink.tags.length > 0) {

                        setIsPollingTags(false);
                        // Notify parent to update everything
                        if (onLinkUpdate) {
                            onLinkUpdate(freshLink);
                        } else {
                            setLink(prev => ({ ...prev, tags: freshLink.tags }));
                        }
                    }
                }
            } catch (e) {

            }
        }, 2000); // Check every 2 seconds

        // Stop polling after 30 seconds to strictly avoid infinite loops
        const timeoutId = setTimeout(() => {
            setIsPollingTags(false);

        }, 50000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
    }, [isPollingTags, link?.id, link?.url, onLinkUpdate]);

    const [apiKey, setApiKey] = useState<string | null>(null);

    useEffect(() => {
        getConfig().then((config) => {
            setBaseUrl(config.baseUrl);
            setApiKey(config.apiKey);
        });
    }, []);

    // Fetch user profile to get linksRouteTo preference
    const { data: userProfile } = useQuery({
        queryKey: ['userProfile'],
        queryFn: () => apiKey && baseUrl ? getCurrentUser(baseUrl, apiKey) : Promise.reject('No config'),
        enabled: !!apiKey && !!baseUrl,
        staleTime: 1000 * 60 * 5, // Cache for 5 min
    });


    // Effect to handle Preview Polling and Image Fetching
    useEffect(() => {
        let isMounted = true;
        let pollInterval: NodeJS.Timeout | null = null;
        let hasSharedData = sharedImgSrc?.startsWith('data:');

        const fetchData = async () => {
            // Priority 0: If we have optimistic thumbnail from SaveLinkCard, skip everything
            if (optimisticThumbnail) {
                setIsLoading(false);
                return;
            }

            // If we don't have a URL, we can't do much
            if (!link.url || !baseUrl) {
                if (isMounted) setIsLoading(false);
                return;
            }

            // Priority 1: Check IndexedDB cache first (instant display)
            const cachedThumbnail = await getThumbnail(link.url);
            if (cachedThumbnail && isMounted) {
                setImgSrc(cachedThumbnail);
                if (onImgSrcChange) onImgSrcChange(cachedThumbnail);
                setIsLoading(false);
                return; // No need to poll or fetch from API
            }

            // Case 1: Preview is missing/pending (and not explicitly "unavailable")
            // We should poll for it.
            if (!link.preview) {
                // If we have shared data (blob), we show it, but still poll for the DB update just in case?
                // Actually if !link.preview, we shouldn't have a valid preview blob unless optimistic.
                // Assuming inconsistent state, let's allow polling.

                // If we have NO shared image, show loading. 
                // If we have shared image (even favicon), keep showing it but don't set loading=true if unnecessary?
                // But we want to show Pulse skeleton if we are waiting for a real preview.
                // Compromise: If sharedImgSrc is present, no skeleton.
                if (!sharedImgSrc && isMounted) setIsLoading(true);

                pollInterval = setInterval(async () => {
                    try {
                        const response = await chrome.runtime.sendMessage({
                            type: 'GET_LINK_WITH_HIGHLIGHTS',
                            data: { url: link.url }
                        });

                        if (response.success && response.data?.link?.preview) {
                            if (isMounted) {
                                setLink(prev => ({
                                    ...prev,
                                    ...response.data.link,
                                    // Preserve collection data from initial enriched link (includes icon)
                                    collection: {
                                        ...response.data.link?.collection,
                                        ...prev.collection,
                                    }
                                }));
                                // Changing 'link' will trigger this effect again, entering Case 2
                            }
                        }
                    } catch (e) {

                    }
                }, 2000); // Check every 2 seconds

                // Stop polling after 30 seconds to avoid infinite work
                setTimeout(() => {
                    if (pollInterval) clearInterval(pollInterval);
                    if (isMounted && !link.preview && !imgSrc) setIsLoading(false);
                }, 30000);

                return;
            }

            // Case 2: Preview is available (either path or "unavailable")
            if (link.preview && link.preview !== 'unavailable') {
                // If we already have a blob (data URI) in shared source, use it
                if (hasSharedData) {
                    if (isMounted) {
                        setImgSrc(sharedImgSrc!);
                        setIsLoading(false);
                    }
                    return;
                }

                if (isMounted) setIsLoading(true);

                const url = `${baseUrl.replace(/\/$/, '')}/api/v1/archives/${link.id}?format=1&preview=true`;

                chrome.runtime.sendMessage({
                    type: 'FETCH_IMAGE_BLOB',
                    data: { url }
                }, (response) => {
                    if (!isMounted) return;

                    if (response && response.success && response.data?.base64Data) {
                        const newData = response.data.base64Data;
                        setImgSrc(newData);
                        if (onImgSrcChange) onImgSrcChange(newData);
                    } else {
                        // Fallback to favicon
                        const fav = getFaviconUrl(link.url);
                        setImgSrc(fav);
                        if (onImgSrcChange) onImgSrcChange(fav);
                    }
                    setIsLoading(false);
                });
            } else {
                // Preview is "unavailable" or some other string
                if (isMounted) {
                    const fav = getFaviconUrl(link.url);
                    setImgSrc(fav);
                    if (onImgSrcChange) onImgSrcChange(fav);
                    setIsLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [link.preview, link.url, link.id, baseUrl, sharedImgSrc, onImgSrcChange]); // Added deps

    // Open in Linkwarden - opens with user's linksRouteTo preference
    // Format mapping: 0=pdf, 1=monolith, 2=screenshot, 3=readable, 999=web (original)
    const handleOpenInLinkwarden = () => {
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
        <div className="w-full">
            {/* Top Message */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100 font-medium">
                    <div className="bg-blue-600 rounded-full p-1.5 shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                        <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                    </div>
                    <span>{t('savedLink.title')}</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* VOID Card */}
            <div
                className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                style={{
                    background: `linear-gradient(135deg, ${link.collection?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)`,
                }}
            >
                <div className="p-4 flex gap-3">
                    {/* Thumbnail */}
                    <div className="shrink-0 w-16 h-16 bg-void-bg/50 dark:bg-void-bg/20 rounded-xl overflow-hidden flex items-center justify-center border border-void-border/10 relative isolate">
                        {isLoading ? (
                            <>
                                {/* Layer 1: Favicon (z-0) */}
                                <img
                                    src={faviconUrl}
                                    alt=""
                                    className="w-full h-full object-contain p-2 z-0 rounded-xl"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                                {/* Layer 2: Frame overlay (z-10) */}
                                <div className="absolute inset-0 z-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pointer-events-none" />
                                {/* Layer 3: Pulse overlay (z-20) - Top layer */}
                                <div className="absolute inset-0 bg-zinc-400/30 dark:bg-zinc-600/30 animate-[pulse_1.5s_ease-in-out_infinite] z-20 pointer-events-none rounded-xl" />
                            </>
                        ) : (
                            <>
                                <img
                                    src={imgSrc || faviconUrl}
                                    alt="Thumbnail"
                                    className={(imgSrc && imgSrc !== faviconUrl) ? "w-full h-full object-cover z-0 rounded-xl" : "w-full h-full object-contain p-2 z-0 rounded-xl"}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        // Avoid infinite loop if favicon also fails
                                        if (faviconUrl && target.src !== faviconUrl) {
                                            target.src = faviconUrl;
                                            target.className = "w-full h-full object-contain p-2 z-0";
                                        } else {
                                            // Show a generic fallback icon if even favicon fails
                                            target.style.display = 'none';
                                            // Ideally we could show an icon component here
                                        }
                                    }}
                                />
                                {/* Frame overlay for loaded state */}
                                <div className="absolute inset-0 z-10 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none" />
                            </>
                        )}
                        {/* Fallback Icon if image hidden (since we hide img on error) */}
                        {!isLoading && (!imgSrc && !faviconUrl) && (
                            <span className="text-2xl">🌍</span>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                        {/* Title - Add skeleton if missing name? Or just use safe fallback */}
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate pr-2 group-hover:text-blue-600 transition-colors duration-300" title={linkName}>
                            {linkName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            <span className="truncate inline-flex items-center gap-1 font-medium min-w-0">
                                {link.collection?.icon ? (
                                    <Icon icon={link.collection.icon} className="w-3.5 h-3.5 shrink-0" color={link.collection.color} />
                                ) : link.collection?.color ? (
                                    <FolderSimple className="w-3.5 h-3.5 shrink-0" weight="fill" style={{ color: link.collection.color }} />
                                ) : (
                                    <FolderSimple className="w-3.5 h-3.5 shrink-0 text-zinc-400" weight="fill" />
                                )}
                                {collectionName}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span>{formattedDate}</span>
                        </div>
                        {/* Tags - One line, truncated */}
                        {isPollingTags ? (
                            <div className="flex items-center gap-2 mt-2 h-[16px]">
                                <OutlineSparkleIcon className="w-3.5 h-3.5 text-blue-500" loading={true} />
                                <span className="text-[10px] text-zinc-400 font-medium italic animate-pulse">
                                    {t('editLink.generatingTags') || "Generating tags..."}
                                </span>
                            </div>
                        ) : (link.tags && link.tags.length > 0) && (
                            <div className="flex flex-wrap gap-0.5 mt-2 h-[16px] overflow-hidden w-full items-center">
                                {link.tags.map(tag => (
                                    <span key={tag.name} className="inline-flex items-center justify-center px-1.5 h-4 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium text-zinc-600 dark:text-zinc-400 leading-none truncate">
                                        #{tag.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>


                {/* Actions */}
                <div className="flex gap-2 p-2">
                    <button
                        onClick={() => onEdit?.(link)}
                        className="flex-1 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-void-bg/30 dark:bg-void-bg/10 border border-void-border/40 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:border-void-border/20 transition-all duration-200 flex items-center justify-center gap-1.5"
                    >
                        {t('savedLink.edit')}
                    </button>
                    <button
                        onClick={handleOpenInLinkwarden}
                        className="flex-[1.5] py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-void-bg/30 dark:bg-void-bg/10 border border-void-border/40 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:border-void-border/20 transition-all duration-200 flex items-center justify-center gap-1.5"
                    >
                        {t('savedLink.openInLinkwarden')}
                    </button>
                </div>
            </div>
        </div>
    );
};
