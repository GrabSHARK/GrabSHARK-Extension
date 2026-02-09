import { FC } from 'react';
import { PencilSimple, PushPin, CaretLeft, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface LinkHeaderProps {
    isPinned: boolean;
    isPinning: boolean;
    onPin: () => void;
    onBack?: () => void;
    onClose: () => void;
}

export const LinkHeader: FC<LinkHeaderProps> = ({ isPinned, isPinning, onPin, onBack, onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
                <div className="bg-blue-600 rounded-full p-1.5 shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                    <PencilSimple className="w-3.5 h-3.5 text-white" weight="bold" />
                </div>
                <span className="font-medium text-sm text-zinc-700 dark:text-zinc-300">{t('editLink.title')}</span>
            </div>
            <div className="flex items-center gap-1.5">
                {/* Pin Button */}
                <button
                    onClick={onPin}
                    disabled={isPinning}
                    className={`hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors ${isPinned ? 'text-blue-500' : 'text-zinc-500'}`}
                    title={isPinned ? "Unpin" : "Pin"}
                >
                    <PushPin className="w-4 h-4" weight={isPinned ? "fill" : "regular"} />
                </button>

                {/* Back Button */}
                {onBack && (
                    <button
                        onClick={onBack}
                        className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500"
                        title={t('editLink.back')}
                    >
                        <CaretLeft className="w-4 h-4" />
                    </button>
                )}

                {/* Close Button */}
                <button onClick={onClose} className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
