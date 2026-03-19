import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../ui/Switch';
import { RectangleEllipsisIcon } from '../CustomIcons';

// Same icon used in SaveLinkCard
const FullscreenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" d="M2 6V4a2 2 0 0 1 2-2h2M10 2h2a2 2 0 0 1 2 2v2M14 10v2a2 2 0 0 1-2 2h-2M6 14H4a2 2 0 0 1-2-2v-2" />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
);

interface InteractionsSectionProps {
    enableSmartCapture: boolean;
    setEnableSmartCapture: (checked: boolean) => void;
    enableSelectionMenu: boolean;
    setEnableSelectionMenu: (checked: boolean) => void;
}

export const InteractionsSection: FC<InteractionsSectionProps> = ({
    enableSmartCapture,
    setEnableSmartCapture,
    enableSelectionMenu,
    setEnableSelectionMenu,
}) => {
    const { t } = useTranslation();

    return (
        <section>
            <h3 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-3">
                {t('preferences.onPageInteractions')}
            </h3>

            {/* Smart Capture */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 text-zinc-500 dark:text-zinc-400"><FullscreenIcon /></span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {t('preferences.smartCapture')}
                    </span>
                </div>
                <Switch
                    checked={enableSmartCapture}
                    onCheckedChange={(checked) => setEnableSmartCapture(checked)}
                />
            </div>

            {/* Selection Menu */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <RectangleEllipsisIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {t('preferences.selectionMenu')}
                    </span>
                </div>
                <Switch
                    checked={enableSelectionMenu}
                    onCheckedChange={(checked) => setEnableSelectionMenu(checked)}
                />
            </div>

            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {t('preferences.onPageInteractionsDesc')}
            </p>
        </section>
    );
};
