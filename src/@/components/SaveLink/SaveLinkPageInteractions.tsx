import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Label';
import { ShortcutRecorder } from '../ShortcutRecorder';
import { RectangleEllipsisIcon } from '../CustomIcons';
import { ExtensionPreferences, savePreferences } from '../../lib/settings';

// Icon local
const FullscreenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 16 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" d="M2 6V4a2 2 0 0 1 2-2h2M10 2h2a2 2 0 0 1 2 2v2M14 10v2a2 2 0 0 1-2 2h-2M6 14H4a2 2 0 0 1-2-2v-2" />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
);

interface SaveLinkPageInteractionsProps {
    loadingPrefs: boolean;
    prefs: ExtensionPreferences;
    handleToggle: (key: keyof ExtensionPreferences) => void;
    setPrefs: (prefs: ExtensionPreferences) => void;
}

export const SaveLinkPageInteractions: FC<SaveLinkPageInteractionsProps> = ({
    loadingPrefs,
    prefs,
    handleToggle,
    setPrefs
}) => {
    const { t } = useTranslation();

    if (loadingPrefs) return null;

    return (
        <div className="mt-4 px-1">
            <p className="text-xs text-zinc-500 mb-2">{t('preferences.onThisPageInteractions')}</p>

            <div className="space-y-3">
                {/* Smart Capture */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="w-5 h-5 text-zinc-500 flex items-center justify-center shrink-0"><FullscreenIcon /></span>
                        <Label htmlFor="smart-capture" className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
                            {t('settings.capture')}
                        </Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <ShortcutRecorder
                            config={prefs.smartCaptureShortcut}
                            onChange={(newConfig) => {
                                const newPrefs = { ...prefs, smartCaptureShortcut: newConfig };
                                setPrefs(newPrefs);
                                savePreferences(newPrefs);
                            }}
                        />
                        <Switch
                            id="smart-capture"
                            checked={prefs.enableSmartCapture}
                            onCheckedChange={() => handleToggle('enableSmartCapture')}
                        />
                    </div>
                </div>

                {/* Selection Menu */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="w-5 h-5 text-zinc-500 flex items-center justify-center shrink-0"><RectangleEllipsisIcon className="w-5 h-5" /></span>
                        <Label htmlFor="selection-menu" className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
                            {t('settings.selectionMenu')}
                        </Label>
                    </div>
                    <Switch
                        id="selection-menu"
                        checked={prefs.enableSelectionMenu}
                        onCheckedChange={() => handleToggle('enableSelectionMenu')}
                    />
                </div>
            </div>
        </div>
    );
};
