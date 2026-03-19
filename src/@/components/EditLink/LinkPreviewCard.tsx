import { FC } from 'react';
import { UseFormReturn } from 'react-hook-form';

interface LinkPreviewCardProps {
    imgSrc: string;
    faviconUrl: string;
    isLoading: boolean;
    linkUrl: string;
    form: UseFormReturn<any>;
}

export const LinkPreviewCard: FC<LinkPreviewCardProps> = ({
    imgSrc,
    faviconUrl,
    isLoading,
    linkUrl,
    form
}) => {
    return (
        <div className="flex gap-3 mb-4">
            <div className="shrink-0 w-16 h-16 bg-void-bg/50 dark:bg-void-bg/20 rounded-xl overflow-hidden border border-void-border/10 shadow-sm relative flex items-center justify-center isolate">
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
                        <div className="absolute inset-0 bg-zinc-300/30 dark:bg-zinc-700/30 animate-pulse z-20 pointer-events-none rounded-xl" />
                    </>
                ) : (
                    <>
                        <img
                            src={imgSrc || faviconUrl}
                            alt="Thumbnail"
                            className={(imgSrc && imgSrc !== faviconUrl) ? "w-full h-full object-cover z-0 rounded-xl" : "w-full h-full object-contain p-2 z-0 rounded-xl"}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.src !== faviconUrl) {
                                    target.src = faviconUrl;
                                    target.className = "w-full h-full object-contain p-2 z-0 rounded-xl";
                                } else {
                                    target.style.display = 'none';
                                }
                            }}
                        />
                        {/* Frame overlay for loaded state */}
                        <div className="absolute inset-0 z-10 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none" />
                    </>
                )}
            </div>
            <div className="min-w-0 flex flex-col justify-center flex-1">
                <div className="font-medium text-sm">
                    <input
                        className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none transition-all truncate font-semibold placeholder:font-normal placeholder:text-zinc-400 text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600"
                        {...form.register('name')}
                    />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">{linkUrl}</p>
            </div>
        </div>
    );
};
