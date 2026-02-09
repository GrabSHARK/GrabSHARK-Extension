import { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface AccountSectionProps {
    onShowDisconnect: () => void;
}

export const AccountSection: FC<AccountSectionProps> = ({ onShowDisconnect }) => {
    const { t } = useTranslation();

    return (
        <section>
            <h3 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-3">
                {t('preferences.account')}
            </h3>
            <button
                onClick={onShowDisconnect}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
                {t('preferences.disconnect')}
            </button>
        </section>
    );
};
