import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import type { DuplicateLinkConflict } from '../../lib/runtime/messages';

interface DuplicateVersionDialogProps {
    conflict: DuplicateLinkConflict | null;
    isBusy?: boolean;
    onNewVersion: () => void;
    onOpenExisting: () => void;
    onClose: () => void;
}

/**
 * Aynı URL zaten arşivdeyken çıkan karar sayfası. Evin onaylı deseni olan
 * alt-sheet (bkz. DeleteDialog / DisconnectDialog) kullanılır — kartın
 * gövdesini değiştirmek yerine üstüne oturur.
 *
 * Bu yol nadirdir: panel bilinen URL'lerde zaten "kaydedildi" görünümüne
 * gider; buraya yalnızca yerel URL indeksi bayat kaldığında ya da URL
 * normalize farkı olduğunda düşülür.
 */
export const DuplicateVersionDialog: FC<DuplicateVersionDialogProps> = ({
    conflict,
    isBusy,
    onNewVersion,
    onOpenExisting,
    onClose,
}) => {
    const { t } = useTranslation();

    if (!conflict) return null;

    return (
        <div className="absolute bottom-4 left-4 right-4 z-50 flex flex-col gap-3 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('duplicate.title') || 'Already in your archive'}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('duplicate.desc') ||
                        'You already archived this page. Capture how it looks now as a new version, or open the one you have.'}
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                    {t('duplicate.versionCount', { count: conflict.existing.versionCount }) ||
                        `${conflict.existing.versionCount} versions`}
                </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs h-8"
                    onClick={onClose}
                    disabled={isBusy}
                >
                    {t('common.cancel') || 'Cancel'}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs h-8"
                    onClick={onOpenExisting}
                    disabled={isBusy}
                >
                    {t('duplicate.openExisting') || 'Open existing'}
                </Button>
                <Button
                    size="sm"
                    className="rounded-full text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                    onClick={onNewVersion}
                    disabled={isBusy}
                >
                    {t('duplicate.newVersion') || 'New version'}
                </Button>
            </div>
        </div>
    );
};
