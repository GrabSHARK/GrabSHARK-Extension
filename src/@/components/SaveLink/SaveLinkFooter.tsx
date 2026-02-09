import { FC } from 'react';
import { CircleNotch, Check } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface SaveLinkFooterProps {
    onSave: () => void;
    isSaving: boolean;
    saveSuccess: boolean;
    onPreferences?: () => void;
    openOptions: () => void;
}

export const SaveLinkFooter: FC<SaveLinkFooterProps> = ({
    onSave,
    isSaving,
    saveSuccess,
    onPreferences,
    openOptions
}) => {
    const { t } = useTranslation();

    return (
        <div className="mt-3">
            {/* Save Button */}
            <Button
                onClick={onSave}
                className={cn(
                    "w-full h-11 rounded-xl font-semibold transition-all duration-300",
                    saveSuccess
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 shadow-none pointer-events-none"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_rgba(37,99,235,0.45)]"
                )}
                disabled={isSaving || saveSuccess}
            >
                {isSaving ? (
                    <CircleNotch className="w-5 h-5 animate-spin" />
                ) : saveSuccess ? (
                    <Check className="w-5 h-5" weight="bold" />
                ) : (
                    "Save"
                )}
            </Button>

            {/* Footer Preferences Link */}
            <div className="mt-4 pt-3 border-t border-zinc-300 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                <button
                    onClick={onPreferences || openOptions}
                    className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                    {t('settings.preferences')}
                </button>
            </div>
        </div>
    );
};
