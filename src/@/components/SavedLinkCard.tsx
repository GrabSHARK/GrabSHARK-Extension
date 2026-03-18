import { useState, useEffect } from 'react';
import { LinkWithHighlights } from '../lib/types/highlight';
import { Check, FolderSimple, X } from '@phosphor-icons/react';
import { OutlineSparkleIcon } from './CustomIcons';
import Icon from './Icon';
import { format } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { getConfig } from '../lib/config';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../lib/actions/users';
import { getThumbnail } from '../lib/thumbnailCache';

interface SavedLinkCardProps {
    link: LinkWithHighlights; onEdit?: (link: LinkWithHighlights) => void;
    sharedImgSrc?: string; onImgSrcChange?: (src: string) => void; onClose?: () => void;
    onLinkUpdate?: (link: LinkWithHighlights) => void;
}

// --- Saved Link Polling (inlined from useSavedLinkPolling) ---

function useSavedLinkPolling({
    initialLink, link, setLink, baseUrl, sharedImgSrc, onImgSrcChange, onLinkUpdate, getFaviconUrl,
}: {
    initialLink: LinkWithHighlights & { _optimisticThumbnail?: string; _skipAiPolling?: boolean; _expectAiTags?: boolean };
    link: LinkWithHighlights;
    setLink: React.Dispatch<React.SetStateAction<LinkWithHighlights>>;
    baseUrl: string | null;
    sharedImgSrc?: string;
    onImgSrcChange?: (src: string) => void;
    onLinkUpdate?: (link: LinkWithHighlights) => void;
    getFaviconUrl: (url?: string) => string;
}) {
    const optimisticThumbnail = (initialLink as any)?._optimisticThumbnail;
    const [imgSrc, setImgSrc] = useState<string>(optimisticThumbnail || sharedImgSrc || '');
    const [isLoading, setIsLoading] = useState<boolean>(!optimisticThumbnail && !sharedImgSrc);

    // Tag polling state
    const [isPollingTags, setIsPollingTags] = useState(() => {
        if ((initialLink as any)?._skipAiPolling) return false;
        const hasNoTags = !initialLink.tags || initialLink.tags.length === 0;
        if (!hasNoTags) return false;
        try {
            const stored = sessionStorage.getItem(`link_ai_pref_${initialLink.id}`);
            if (stored) return JSON.parse(stored).expectAi === true;
        } catch { }
        if ((initialLink as any)?._expectAiTags === true) {
            return (Date.now() - new Date(initialLink.createdAt || Date.now()).getTime()) < 15000;
        }
        return false;
    });

    // Tag polling effect
    useEffect(() => {
        if (!isPollingTags || !link?.id) return;
        const intervalId = setInterval(async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'GET_LINK_WITH_HIGHLIGHTS', data: { url: link.url } });
                if (response.success && response.data?.link?.tags?.length > 0) {
                    setIsPollingTags(false);
                    if (onLinkUpdate) onLinkUpdate(response.data.link);
                    else setLink(prev => ({ ...prev, tags: response.data.link.tags }));
                }
            } catch { }
        }, 2000);
        const timeoutId = setTimeout(() => setIsPollingTags(false), 30000);
        return () => { clearInterval(intervalId); clearTimeout(timeoutId); };
    }, [isPollingTags, link?.id, link?.url, onLinkUpdate]);

    // Preview polling & image fetching
    useEffect(() => {
        let isMounted = true;
        let pollInterval: NodeJS.Timeout | null = null;
        const hasSharedData = sharedImgSrc?.startsWith('data:');

        const fetchData = async () => {
            if (optimisticThumbnail) { setIsLoading(false); return; }
            if (!link.url || !baseUrl) { if (isMounted) setIsLoading(false); return; }

            const cached = await getThumbnail(link.url);
            if (cached && isMounted) { setImgSrc(cached); onImgSrcChange?.(cached); setIsLoading(false); return; }

            if (!link.preview) {
                if (!sharedImgSrc && isMounted) setIsLoading(true);
                pollInterval = setInterval(async () => {
                    try {
                        const r = await chrome.runtime.sendMessage({ type: 'GET_LINK_WITH_HIGHLIGHTS', data: { url: link.url } });
                        if (r.success && r.data?.link?.preview && isMounted) {
                            setLink(prev => ({ ...prev, ...r.data.link, collection: { ...r.data.link?.collection, ...prev.collection } }));
                        }
                    } catch { }
                }, 2000);
                setTimeout(() => { if (pollInterval) clearInterval(pollInterval); if (isMounted && !link.preview && !imgSrc) setIsLoading(false); }, 30000);
                return;
            }

            if (link.preview && link.preview !== 'unavailable') {
                if (hasSharedData && isMounted) { setImgSrc(sharedImgSrc!); setIsLoading(false); return; }
                if (isMounted) setIsLoading(true);
                const url = `${baseUrl.replace(/\/$/, '')}/api/v1/archives/${link.id}?format=1&preview=true`;
                chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_BLOB', data: { url } }, (response) => {
                    if (!isMounted) return;
                    if (response?.success && response.data?.base64Data) { setImgSrc(response.data.base64Data); onImgSrcChange?.(response.data.base64Data); }
                    else { const fav = getFaviconUrl(link.url); setImgSrc(fav); onImgSrcChange?.(fav); }
                    setIsLoading(false);
                });
            } else {
                if (isMounted) { const fav = getFaviconUrl(link.url); setImgSrc(fav); onImgSrcChange?.(fav); setIsLoading(false); }
            }
        };
        fetchData();
        return () => { isMounted = false; if (pollInterval) clearInterval(pollInterval); };
    }, [link.preview, link.url, link.id, baseUrl, sharedImgSrc, onImgSrcChange]);

    return { imgSrc, isLoading, isPollingTags, setIsPollingTags };
}

// --- SavedLinkCard Component ---

export const SavedLinkCard = ({ link: rawInitialLink, onEdit, sharedImgSrc, onImgSrcChange, onClose, onLinkUpdate }: SavedLinkCardProps) => {
    const initialLink = (rawInitialLink as any)?.response || rawInitialLink;
    const { t, i18n } = useTranslation();

    const [link, setLink] = useState<LinkWithHighlights>(() => ({
        ...initialLink, url: initialLink.url || window.location.href, name: initialLink.name || document.title || t('savedLink.untitled'),
    }));

    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);
    useEffect(() => { getConfig().then(c => { setBaseUrl(c.baseUrl); setApiKey(c.apiKey); }); }, []);

    const getFaviconUrl = (url?: string) => url ? `https://www.google.com/s2/favicons?sz=64&domain_url=${url}` : '';
    const faviconUrl = getFaviconUrl(link.url);

    const { imgSrc, isLoading, isPollingTags, setIsPollingTags } = useSavedLinkPolling({
        initialLink: initialLink as any, link, setLink, baseUrl, sharedImgSrc, onImgSrcChange, onLinkUpdate, getFaviconUrl,
    });

    const { data: userProfile } = useQuery({
        queryKey: ['userProfile'],
        queryFn: () => apiKey && baseUrl ? getCurrentUser(baseUrl, apiKey) : Promise.reject('No config'),
        enabled: !!apiKey && !!baseUrl, staleTime: 1000 * 60 * 5,
    });

    // Sync link on prop change
    useEffect(() => {
        setLink(prev => {
            const mergedCollection = initialLink?.collection ? { ...initialLink.collection, icon: prev.collection?.icon || initialLink.collection?.icon, color: prev.collection?.color || initialLink.collection?.color } : prev.collection;
            if (initialLink.tags?.length > 0 && isPollingTags) setIsPollingTags(false);
            return { ...prev, ...initialLink, url: initialLink.url || prev.url || window.location.href, name: initialLink.name || prev.name || document.title || t('savedLink.untitled'), collection: mergedCollection };
        });
    }, [initialLink]);

    const formattedDate = link.createdAt ? format(new Date(link.createdAt), 'MMM d', { locale: i18n.language === 'tr' ? tr : enUS }) : t('savedLink.justNow');
    const collectionName = link.collection?.name || t('bookmark.unorganized');

    const handleOpenInSpark = () => {
        if (!link.id || !baseUrl) return;
        const formatMap: Record<string, number> = { 'ORIGINAL': 999, 'PDF': 0, 'MONOLITH': 1, 'SCREENSHOT': 2, 'READABLE': 3, 'DETAILS': 1 };
        const formatNum = formatMap[userProfile?.linksRouteTo || 'MONOLITH'] ?? 1;
        chrome.runtime.sendMessage({ type: 'OPEN_TAB', data: { url: `${baseUrl.replace(/\/$/, '')}/dashboard?openPreview=${link.id}&format=${formatNum}` } });
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100 font-medium">
                    <div className="bg-blue-600 rounded-full p-1.5 shadow-[0_0_12px_rgba(59,130,246,0.5)]"><Check className="w-3.5 h-3.5 text-white stroke-[3px]" /></div>
                    <span>{t('savedLink.title')}</span>
                </div>
                {onClose && (<button onClick={onClose} className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500"><X className="w-4 h-4" /></button>)}
            </div>

            <div className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: `linear-gradient(135deg, ${link.collection?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)` }}>
                <div className="p-4 flex gap-3">
                    <div className="shrink-0 w-16 h-16 bg-void-bg/50 dark:bg-void-bg/20 rounded-xl overflow-hidden flex items-center justify-center border border-void-border/10 relative isolate">
                        {isLoading ? (<>
                            <img src={faviconUrl} alt="" className="w-full h-full object-contain p-2 z-0 rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <div className="absolute inset-0 z-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pointer-events-none" />
                            <div className="absolute inset-0 bg-zinc-400/30 dark:bg-zinc-600/30 animate-[pulse_1.5s_ease-in-out_infinite] z-20 pointer-events-none rounded-xl" />
                        </>) : (<>
                            <img src={imgSrc || faviconUrl} alt="Thumbnail"
                                className={(imgSrc && imgSrc !== faviconUrl) ? "w-full h-full object-cover z-0 rounded-xl" : "w-full h-full object-contain p-2 z-0 rounded-xl"}
                                onError={(e) => { const t = e.target as HTMLImageElement; if (faviconUrl && t.src !== faviconUrl) { t.src = faviconUrl; t.className = "w-full h-full object-contain p-2 z-0"; } else t.style.display = 'none'; }} />
                            <div className="absolute inset-0 z-10 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none" />
                        </>)}
                        {!isLoading && (!imgSrc && !faviconUrl) && <span className="text-2xl">🌍</span>}
                    </div>

                    <div className="flex flex-col justify-center min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate pr-2 group-hover:text-blue-600 transition-colors duration-300" title={link.name}>{link.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            <span className="truncate inline-flex items-center gap-1 font-medium min-w-0">
                                {link.collection?.icon ? <Icon icon={link.collection.icon} className="w-3.5 h-3.5 shrink-0" color={link.collection.color} />
                                    : link.collection?.color ? <FolderSimple className="w-3.5 h-3.5 shrink-0" weight="fill" style={{ color: link.collection.color }} />
                                        : <FolderSimple className="w-3.5 h-3.5 shrink-0 text-zinc-400" weight="fill" />}
                                {collectionName}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span>{formattedDate}</span>
                        </div>
                        {isPollingTags ? (
                            <div className="flex items-center gap-2 mt-2 h-[16px]">
                                <OutlineSparkleIcon className="w-3.5 h-3.5 text-blue-500" loading={true} />
                                <span className="text-[10px] text-zinc-400 font-medium italic animate-pulse">{t('editLink.generatingTags') || "Generating tags..."}</span>
                            </div>
                        ) : (link.tags && link.tags.length > 0) && (
                            <div className="flex flex-wrap gap-0.5 mt-2 h-[16px] overflow-hidden w-full items-center">
                                {link.tags.map(tag => (
                                    <span key={tag.name} className="inline-flex items-center justify-center px-1.5 h-4 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium text-zinc-600 dark:text-zinc-400 leading-none truncate">#{tag.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 p-2">
                    <button onClick={() => onEdit?.(link)} className="flex-1 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-void-bg/30 dark:bg-void-bg/10 border border-void-border/40 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:border-void-border/20 transition-all duration-200 flex items-center justify-center gap-1.5">{t('savedLink.edit')}</button>
                    <button onClick={handleOpenInSpark} className="flex-[1.5] py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-void-bg/30 dark:bg-void-bg/10 border border-void-border/40 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:border-void-border/20 transition-all duration-200 flex items-center justify-center gap-1.5">{t('savedLink.openInGrabSHARK')}</button>
                </div>
            </div>
        </div>
    );
};
