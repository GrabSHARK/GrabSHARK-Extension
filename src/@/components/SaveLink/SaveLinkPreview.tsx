import { FC } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Camera, FilePdf, FileImage, FileText, FileHtml } from '@phosphor-icons/react';
import { cn } from '../../lib/utils';
import { OutlineSparkleIcon } from '../CustomIcons';

interface SaveLinkPreviewProps {
    currentUrl: string;
    faviconUrl: string;
    form: UseFormReturn<any>;
    initialTitle: string;
    archiveOptions: any;
    setArchiveOptions: (options: any) => void;
    uploadScreenshot: boolean;
    setUploadScreenshot: (val: boolean) => void;
    userProfile: any;
    manualAiToggleRef: React.MutableRefObject<boolean>;
}

export const SaveLinkPreview: FC<SaveLinkPreviewProps> = ({
    currentUrl,
    faviconUrl,
    form,
    initialTitle,
    archiveOptions,
    setArchiveOptions,
    uploadScreenshot,
    setUploadScreenshot,
    userProfile,
    manualAiToggleRef
}) => {
    return (
        <div className="p-4 flex gap-3 items-center">
            {/* Thumbnail */}
            <div
                className="shrink-0 w-16 h-16 bg-void-bg/50 dark:bg-void-bg/20 rounded-xl overflow-hidden border border-void-border/10 relative flex items-center justify-center group cursor-pointer isolate"
                onClick={() => setUploadScreenshot(!uploadScreenshot)}
            >
                {/* Layer 1: Favicon (z-0) */}
                {currentUrl ? (
                    <img
                        src={faviconUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-contain p-2 z-0 rounded-xl"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-lg z-0">
                        <span className="text-2xl">🌍</span>
                    </div>
                )}
                {(!faviconUrl && !currentUrl) && (
                    <span className="text-2xl z-0">🌍</span>
                )}

                {/* Layer 2: Frame Overlay (z-5) */}
                <div className="absolute inset-0 z-5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pointer-events-none" />

                {/* Screenshot Overlay (z-10) */}
                <div className={cn(
                    "absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-opacity duration-200 z-10",
                    uploadScreenshot ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                    <Camera className={cn("w-5 h-5 text-white mb-0.5", uploadScreenshot && "text-blue-400")} />
                    <span className={cn("text-[9px] font-medium text-white leading-tight text-center px-1", uploadScreenshot && "text-blue-400")}>
                        Shot on<br />Page
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col justify-center min-w-0 flex-1">
                {/* Title: Editable Input replacing H3 */}
                <div className="font-semibold text-sm">
                    <input
                        className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none transition-all truncate font-semibold placeholder:font-normal placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600"
                        {...form.register('name')}
                        placeholder={initialTitle || "Title"}
                    />
                </div>

                {/* URL */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    <span className="truncate">{currentUrl}</span>
                </div>

                {/* Archive Format Toggles */}
                <div className="flex items-center gap-1.5 mt-1.5 mb-0.5">
                    {archiveOptions ? [
                        { key: 'archiveAsPDF', icon: FilePdf, label: 'PDF' },
                        { key: 'archiveAsMonolith', icon: FileHtml, label: 'Monolith' },
                        { key: 'archiveAsReadable', icon: FileText, label: 'Readable' },
                        { key: 'archiveAsScreenshot', icon: FileImage, label: 'Screenshot' },
                        // AI Tag toggle - only shown if user has AI enabled
                        ...(userProfile?.aiTaggingMethod && userProfile.aiTaggingMethod !== 'DISABLED'
                            ? [{ key: 'aiTag', icon: OutlineSparkleIcon, label: 'AI Tagging' }]
                            : []),
                    ].map((item) => {
                        const isActive = archiveOptions[item.key as keyof typeof archiveOptions];
                        const IconComp = item.icon;

                        return (
                            <div key={item.key} className="group relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (item.key === 'aiTag') manualAiToggleRef.current = true;
                                        setArchiveOptions((prev: any) => ({ ...prev, [item.key]: !isActive }))
                                    }}
                                    className={cn(
                                        "w-7 h-7 flex items-center justify-center cursor-pointer transition-all duration-300 rounded-lg border",
                                        isActive
                                            ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-400/15 border-blue-200 dark:border-blue-400/30"
                                            : "text-zinc-400 dark:text-zinc-600 bg-void-island/20 dark:bg-void-island/10 border-void-border/10 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:border-void-border/20"
                                    )}
                                    title={item.label}
                                >
                                    <IconComp className="w-3.5 h-3.5" weight={isActive ? "fill" : "regular"} />
                                </button>
                            </div>
                        );
                    }) : (
                        // Loading Skeleton
                        <>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-6 h-6 flex items-center justify-center">
                                    <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse"></div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
