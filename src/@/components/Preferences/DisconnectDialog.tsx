import { FC } from 'react';
import { Button } from '../ui/Button';
import { useTranslation } from 'react-i18next';

interface DisconnectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onDisconnect: () => void;
}

export const DisconnectDialog: FC<DisconnectDialogProps> = ({ isOpen, onClose, onDisconnect }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="absolute bottom-4 left-4 right-4 z-50 flex flex-col gap-3 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('preferences.disconnectTitle')}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('preferences.disconnectConfirm')}</p>
            </div>
            <div className="flex gap-2 justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs h-8"
                    onClick={onClose}
                >
                    {t('common.cancel')}
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full text-xs h-8 bg-red-600 hover:bg-red-700 text-white"
                    onClick={onDisconnect}
                >
                    {t('preferences.disconnect')}
                </Button>
            </div>
        </div>
    );
};
