import { FC } from 'react';
import { X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface SaveLinkHeaderProps {
    onClose?: () => void;
}

const BookmarkFill = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
        <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2" />
    </svg>
);

export const SaveLinkHeader: FC<SaveLinkHeaderProps> = ({ onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                <div className="bg-blue-600 rounded-full p-1.5 shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                    <BookmarkFill className="w-3.5 h-3.5 text-white" />
                </div>
                <span>{t('saveLink.title') || "Save Link"}</span>
            </div>
            {onClose && (
                <button onClick={onClose} className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500">
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};
