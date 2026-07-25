import { useState, useEffect } from 'react';
import { LinkWithHighlights } from '../lib/types/highlight';
import { Check, FolderSimple, X } from '@phosphor-icons/react';
import { OutlineSparkleIcon } from './CustomIcons';
import { format } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';
import { getThumbnail } from '../lib/thumbnailCache';
import { fetchAuthorizedImageUrl } from '../lib/authorizedImageUrl';
import { getExtensionBootstrapState } from '../lib/actions/bootstrap';
import { subscribeToLinkPreview, subscribeToLinkTags } from '../lib/linkPollers';
import { openTabMessage } from '../lib/runtime/messages';
import { readAiTagExpectation } from '../lib/runtime/sessionCache';

interface SavedLinkCardProps {
    link: LinkWithHighlights;
    onEdit?: (link: LinkWithHighlights) => void;
    sharedImgSrc?: string;
    onImgSrcChange?: (src: string) => void;
    onClose?: () => void;
    onLinkUpdate?: (link: LinkWithHighlights) => void;
}

function getFaviconUrl(url?: string): string {
    return url ? `https://www.google.com/s2/favicons?sz=64&domain_url=${url}` : '';
}

function useSavedLinkPolling({
    initialLink, link, setLink, baseUrl, sharedImgSrc, onImgSrcChange, onLinkUpdate,
}: {
    initialLink: LinkWithHighlights & { _optimisticThumbnail?: string; _skipAiPolling?: boolean; _expectAiTags?: boolean };
    link: LinkWithHighlights;
    setLink: React.Dispatch<React.SetStateAction<LinkWithHighlights>>;
    baseUrl: string | null;
    sharedImgSrc?: string;
    onImgSrcChange?: (src: string) => void;
    onLinkUpdate?: (link: LinkWithHighlights) => void;
}) {
    const optimisticThumbnail = (initialLink as any)?._optimisticThumbnail;
    const [imgSrc, setImgSrc] = useState<string>(optimisticThumbnail || sharedImgSrc || '');
    const [isLoading, setIsLoading] = useState<boolean>(!optimisticThumbnail && !sharedImgSrc);

    const [isPollingTags, setIsPollingTags] = useState(() => {
        if ((initialLink as any)?._skipAiPolling) return false;
        const hasNoTags = !initialLink.tags || initialLink.tags.length === 0;
        if (!hasNoTags) return false;
        const storedExpectation = readAiTagExpectation(initialLink.id);
        if (storedExpectation !== null) return storedExpectation;
        if ((initialLink as any)?._expectAiTags === true) {
            return (Date.now() - new Date(initialLink.createdAt || Date.now()).getTime()) < 15000;
        }
        return false;
    });

    useEffect(() => {
        if (!isPollingTags || !link?.url) return;

        return subscribeToLinkTags(link.url, {
            onValue: (resolvedLink) => {
                setIsPollingTags(false);
                if (onLinkUpdate) onLinkUpdate(resolvedLink);
                else setLink(prev => ({ ...prev, tags: resolvedLink.tags }));
            },
            onTimeout: () => {
                setIsPollingTags(false);
            },
        });
    }, [isPollingTags, link?.url, onLinkUpdate, setLink]);

    useEffect(() => {
        let isMounted = true;
        let stopPreviewPolling: (() => void) | null = null;
        const hasSharedData = !!sharedImgSrc;

        const fetchData = async () => {
            if (optimisticThumbnail) {
                setIsLoading(false);
                return;
            }
            if (!link.url || !baseUrl) {
                if (isMounted) setIsLoading(false);
                return;
            }

            const cached = await getThumbnail(link.url);
            if (cached && isMounted) {
                setImgSrc(cached);
                onImgSrcChange?.(cached);
                setIsLoading(false);
                return;
            }

            if (!link.preview) {
                if (!sharedImgSrc && isMounted) setIsLoading(true);
                stopPreviewPolling = subscribeToLinkPreview(link.url, {
                    onValue: (resolvedLink) => {
                        if (!isMounted) return;
                        setLink(prev => ({ ...prev, ...resolvedLink, collection: resolvedLink.collection ? ({ ...resolvedLink.collection, ...prev.collection } as any) : prev.collection }));
                    },
                    onTimeout: () => {
                        if (isMounted) setIsLoading(false);
                    },
                });
                return;
            }

            if (link.preview !== 'unavailable') {
                if (hasSharedData && isMounted) {
                    setImgSrc(sharedImgSrc!);
                    setIsLoading(false);
                    return;
                }

                if (isMounted) setIsLoading(true);
                const url = `${baseUrl.replace(/\/$/, '')}/api/v1/archives/${link.id}?format=1&preview=true`;
                try {
                    const objectUrl = await fetchAuthorizedImageUrl(url);
                    if (!isMounted) return;
                    if (objectUrl) {
                        setImgSrc(objectUrl);
                        onImgSrcChange?.(objectUrl);
                    } else {
                        const fav = getFaviconUrl(link.url);
                        setImgSrc(fav);
                        onImgSrcChange?.(fav);
                    }
                } catch {
                    if (!isMounted) return;
                    const fav = getFaviconUrl(link.url);
                    setImgSrc(fav);
                    onImgSrcChange?.(fav);
                } finally {
                    if (isMounted) setIsLoading(false);
                }
            } else if (isMounted) {
                const fav = getFaviconUrl(link.url);
                setImgSrc(fav);
                onImgSrcChange?.(fav);
                setIsLoading(false);
            }
        };

        void fetchData();

        return () => {
            isMounted = false;
            stopPreviewPolling?.();
        };
    }, [baseUrl, link.id, link.preview, link.url, onImgSrcChange, onLinkUpdate, optimisticThumbnail, setLink, sharedImgSrc]);

    return { imgSrc, isLoading, isPollingTags, setIsPollingTags };
}

export const SavedLinkCard = ({ link: rawInitialLink, onEdit, sharedImgSrc, onImgSrcChange, onClose, onLinkUpdate }: SavedLinkCardProps) => {
    const initialLink = (rawInitialLink as any)?.response || rawInitialLink;
    const { t, i18n } = useTranslation();

    const [link, setLink] = useState<LinkWithHighlights>(() => ({
        ...initialLink,
        url: initialLink.url || window.location.href,
        name: initialLink.name || document.title || t('savedLink.untitled'),
    }));

    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<any | null>(null);

    useEffect(() => {
        let active = true;
        getExtensionBootstrapState().then((bootstrap) => {
            if (!active) return;
            setBaseUrl(bootstrap.baseUrl || bootstrap.config?.baseUrl || null);
            setUserProfile(bootstrap.user || null);
        }).catch(() => {
            if (!active) return;
            setBaseUrl(null);
            setUserProfile(null);
        });
        return () => {
            active = false;
        };
    }, []);

    const faviconUrl = getFaviconUrl(link.url);

    const { imgSrc, isLoading, isPollingTags, setIsPollingTags } = useSavedLinkPolling({
        initialLink: initialLink as any,
        link,
        setLink,
        baseUrl,
        sharedImgSrc,
        onImgSrcChange,
        onLinkUpdate,
    });

    useEffect(() => {
        setLink(prev => {
            const mergedCollection = initialLink?.collection
                ? {
                    ...initialLink.collection,
                    icon: prev.collection?.icon || initialLink.collection?.icon,
                    color: prev.collection?.color || initialLink.collection?.color,
                }
                : prev.collection;
            if (initialLink.tags?.length > 0 && isPollingTags) setIsPollingTags(false);
            return {
                ...prev,
                ...initialLink,
                url: initialLink.url || prev.url || window.location.href,
                name: initialLink.name || prev.name || document.title || t('savedLink.untitled'),
                collection: mergedCollection,
            };
        });
    }, [initialLink, isPollingTags, setIsPollingTags, t]);

    const formattedDate = link.createdAt ? format(new Date(link.createdAt), 'MMM d', { locale: i18n.language === 'tr' ? tr : enUS }) : t('savedLink.justNow');
    const collectionName = link.collection?.name || t('bookmark.unorganized');

    const handleOpenInGrabSHARK = () => {
        if (!link.id || !baseUrl) return;
        const formatMap: Record<string, number> = { ORIGINAL: 999, PDF: 0, MONOLITH: 1, SCREENSHOT: 2, READABLE: 3, DETAILS: 1 };
        const formatNum = formatMap[userProfile?.linksRouteTo || 'MONOLITH'] ?? 1;
        void openTabMessage(`${baseUrl.replace(/\/$/, '')}/dashboard?openPreview=${link.id}&format=${formatNum}`).catch(() => { });
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100 font-medium">
                    <div className="bg-primary rounded-full p-1.5 shadow-[0_0_12px_hsl(var(--primary)/0.5)]"><Check className="w-3.5 h-3.5 text-white stroke-[3px]" /></div>
                    <span>{t('savedLink.title')}</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div
                className="group bg-void-island/40 backdrop-blur-md rounded-2xl border border-void-border/10 shadow-lg dark:shadow-black/50 shadow-black/5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: `linear-gradient(135deg, ${link.collection?.color || '#808080'}15 0%, rgba(128, 128, 128, 0.05) 100%)` }}
            >
                <div className="p-4 flex gap-3">
                    <div className="shrink-0 w-16 h-16 bg-void-bg/50 dark:bg-void-bg/20 rounded-xl overflow-hidden flex items-center justify-center border border-void-border/10 relative isolate">
                        {isLoading ? (
                            <>
                                <img src={faviconUrl} alt="" className="w-full h-full object-contain p-2 z-0 rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <div className="absolute inset-0 z-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pointer-events-none" />
                                <div className="absolute inset-0 bg-zinc-400/30 dark:bg-zinc-600/30 animate-[pulse_1.5s_ease-in-out_infinite] z-20 pointer-events-none rounded-xl" />
                            </>
                        ) : (
                            <>
                                <img
                                    src={imgSrc || faviconUrl}
                                    alt="Thumbnail"
                                    className={(imgSrc && imgSrc !== faviconUrl) ? 'w-full h-full object-cover z-0 rounded-xl' : 'w-full h-full object-contain p-2 z-0 rounded-xl'}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        if (faviconUrl && target.src !== faviconUrl) {
                                            target.src = faviconUrl;
                                            target.className = 'w-full h-full object-contain p-2 z-0';
                                        } else {
                                            target.style.display = 'none';
                                        }
                                    }}
                                />
                                <div className="absolute inset-0 z-10 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none" />
                            </>
                        )}
                        {!isLoading && (!imgSrc && !faviconUrl) && <span className="text-2xl">🌍</span>}
                    </div>

                    <div className="flex flex-col justify-center min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate pr-2 group-hover:text-primary transition-colors duration-300" title={link.name}>{link.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            <span className="truncate inline-flex items-center gap-1 font-medium min-w-0">
                                {link.collection?.color ? (
                                    <FolderSimple className="w-3.5 h-3.5 shrink-0" weight="fill" style={{ color: link.collection.color }} />
                                ) : (
                                    <FolderSimple className="w-3.5 h-3.5 shrink-0 text-zinc-400" weight="fill" />
                                )}
                                {collectionName}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span>{formattedDate}</span>
                        </div>
                        {isPollingTags ? (
                            <div className="flex items-center gap-2 mt-2 h-[16px]">
                                <OutlineSparkleIcon className="w-3.5 h-3.5 text-primary" loading={true} />
                                <span className="text-[10px] text-zinc-400 font-medium italic animate-pulse">{t('editLink.generatingTags') || 'Generating tags...'}</span>
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
                    <button onClick={handleOpenInGrabSHARK} className="flex-[1.5] py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-void-bg/30 dark:bg-void-bg/10 border border-void-border/40 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:border-void-border/20 transition-all duration-200 flex items-center justify-center gap-1.5">{t('savedLink.openInGrabSHARK')}</button>
                </div>
            </div>
        </div>
    );
};



