import { FC } from 'react';
import { CircleNotch, Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { UseFormReturn } from 'react-hook-form';

interface LinkFooterProps {
    form: UseFormReturn<any>;
    onSave: () => void;
    saveSuccess: boolean;
    isSaving: boolean;
    isDeleting: boolean;
    onShowDeleteConfirm: () => void;
    isArchived: boolean;
    isArchiving: boolean;
    onArchive: () => void;
    onOpenInSpark: () => void;
}

export const LinkFooter: FC<LinkFooterProps> = ({
    form,
    onSave,
    saveSuccess,
    isSaving,
    isDeleting,
    onShowDeleteConfirm,
    isArchived,
    isArchiving,
    onArchive,
    onOpenInSpark
}) => {
    const { t } = useTranslation();

    return (
        <div className="mt-3 space-y-3">
            {/* Done Button - State Cycle: Text -> Spinner -> Check -> Text */}
            <Button
                onClick={() => {
                    if (saveSuccess) return; // Already saved, don't re-submit
                    onSave();
                }}
                className={cn(
                    "w-full h-11 rounded-xl font-semibold transition-all duration-300",
                    form.formState.isDirty && !saveSuccess
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_rgba(37,99,235,0.45)]"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 shadow-none pointer-events-none"
                )}
                disabled={isSaving || (!form.formState.isDirty && !saveSuccess)}
            >
                {isSaving ? (
                    <CircleNotch className="w-5 h-5 animate-spin" />
                ) : saveSuccess ? (
                    <Check className="w-5 h-5" weight="bold" />
                ) : (
                    t('editLink.save')
                )}
            </Button>

            {/* Secondary Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-300 dark:border-zinc-800 px-1">
                <div className="flex gap-4">
                    <button
                        onClick={onShowDeleteConfirm}
                        disabled={isDeleting}
                        className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium flex items-center gap-1.5 transition-colors"
                    >
                        {t('editLink.delete')}
                    </button>
                    <button
                        className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium transition-colors"
                        onClick={onArchive}
                        disabled={isArchiving}
                    >
                        {isArchived ? t('editLink.unarchive') : t('editLink.archive')}
                    </button>
                </div>
                <button
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium transition-colors"
                    onClick={onOpenInSpark}
                >
                    {t('editLink.openInLinkwarden')}
                </button>
            </div>
        </div>
    );
};
