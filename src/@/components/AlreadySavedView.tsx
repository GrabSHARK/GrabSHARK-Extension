
import { LinkWithHighlights } from '../lib/types/highlight';
import { useTranslation } from 'react-i18next';
import { SavedLinkCard } from './SavedLinkCard';
import { ExtensionSettings } from './ExtensionSettings';
import { openOptions } from '../lib/utils';
import { CircleNotch } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';

interface AlreadySavedViewProps {
    link?: LinkWithHighlights | null; // Can be null during upload
    onEdit: (link?: LinkWithHighlights) => void;
    sharedImgSrc?: string;
    onImgSrcChange?: (src: string) => void;
    onClose?: () => void;
    isUploading?: boolean;
    onLinkUpdate?: (updatedLink: Partial<LinkWithHighlights>) => void; // Callback for Edit view updates
    onPreferences?: () => void; // Open preferences panel
}

export const AlreadySavedView = ({ link, onEdit, sharedImgSrc, onImgSrcChange, onClose, isUploading, onLinkUpdate, onPreferences }: AlreadySavedViewProps) => {
    const { t } = useTranslation();
    const [showOverlay, setShowOverlay] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);

    // Handle overlay state
    useEffect(() => {
        if (isUploading) {
            setShowOverlay(true);
            setFadingOut(false);
        } else if (showOverlay) {
            // Start fade out when uploading finishes
            setFadingOut(true);
            const timer = setTimeout(() => {
                setShowOverlay(false);
                setFadingOut(false);
            }, 500); // Transition duration
            return () => clearTimeout(timer);
        }
    }, [isUploading]);

    return (
        <div className="flex flex-col h-full relative">
            {/* Content Area */}
            <div className="flex-1 space-y-1 p-4">
                {link ? (
                    <SavedLinkCard
                        link={link}
                        onEdit={onEdit}
                        sharedImgSrc={sharedImgSrc}
                        onImgSrcChange={onImgSrcChange}
                        onClose={onClose}
                        onLinkUpdate={onLinkUpdate}
                    />
                ) : (
                    /* Skeleton / Placeholder when uploading and no link yet */
                    <div className="w-full opacity-50 pointer-events-none filter blur-[2px]">
                        {/* We render a dummy SavedLinkCard for layout stability under blur */}
                        <SavedLinkCard
                            link={{
                                id: 0,
                                url: '',
                                name: 'Loading...',
                                description: '',
                                createdAt: new Date().toISOString(),
                                collectionId: 0,
                                collection: { id: 0, name: '...', color: '#ccc', ownerId: 0 },
                                tags: []
                            }}
                            onEdit={() => { }}
                            onClose={onClose}
                        />
                    </div>
                )}

                <ExtensionSettings />

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                    <button
                        onClick={onPreferences || openOptions}
                        className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                    >
                        {t('settings.preferences')}
                    </button>
                </div>
            </div>

            {/* Uploading Overlay */}
            {showOverlay && (
                <div className={`absolute inset-0 bg-black/50 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm rounded-xl transition-opacity duration-500 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}>
                    <CircleNotch className="w-8 h-8 animate-spin text-white/90 mb-3" />
                    <h3 className="text-lg font-medium tracking-tight">Uploading image...</h3>
                    <p className="text-xs text-white/60 mt-1 max-w-[200px] text-center leading-relaxed">
                        Please do not close this window, this may take a few seconds depending on the size of the page.
                    </p>
                </div>
            )}
        </div>
    );
};
