import { useEffect, useState } from 'react';
import { Switch } from './ui/Switch';
import { Label } from './ui/Label';
import {
    DEFAULT_PREFERENCES,
    ExtensionPreferences,
    getPreferences,
    savePreferences
} from '../lib/settings';
import { ShortcutRecorder } from './ShortcutRecorder';
import { RectangleEllipsisIcon } from './CustomIcons';
import { useTranslation } from 'react-i18next';

const FullscreenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 16 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" d="M2 6V4a2 2 0 0 1 2-2h2M10 2h2a2 2 0 0 1 2 2v2M14 10v2a2 2 0 0 1-2 2h-2M6 14H4a2 2 0 0 1-2-2v-2" />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
);



const BookmarkCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0" />
        <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1z" />
    </svg>
);

const HighlighterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M11.096.644a2 2 0 0 1 2.791.036l1.433 1.433a2 2 0 0 1 .035 2.791l-.413.435-8.07 8.995a.5.5 0 0 1-.372.166h-3a.5.5 0 0 1-.234-.058l-.412.412A.5.5 0 0 1 2.5 15h-2a.5.5 0 0 1-.354-.854l1.412-1.412A.5.5 0 0 1 1.5 12.5v-3a.5.5 0 0 1 .166-.372l8.995-8.07zm-.115 1.47L2.727 9.52l3.753 3.753 7.406-8.254zm3.585 2.17.064-.068a1 1 0 0 0-.017-1.396L13.18 1.387a1 1 0 0 0-1.396-.018l-.068.065zM5.293 13.5 2.5 10.707v1.586L3.707 13.5z" />
    </svg>
);

export const ExtensionSettings = () => {
    const { t } = useTranslation();
    const [prefs, setPrefs] = useState<ExtensionPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPreferences = async () => {
            // First load client storage preferences (for non-domain settings)
            const clientPrefs = await getPreferences();

            // Try to get domain-specific preferences from DB
            const hostname = new URL(window.location.href).hostname;
            chrome.runtime.sendMessage(
                { type: 'GET_DOMAIN_PREFERENCE', data: { domain: hostname } },
                (response) => {
                    if (response?.success && response.data) {

                        // Merge: DB prefs override client prefs for domain-specific settings
                        setPrefs({
                            ...clientPrefs,
                            enableSmartCapture: response.data.enableSmartCapture,
                            enableSelectionMenu: response.data.enableSelectionMenu,
                        });
                    } else {

                        setPrefs(clientPrefs);
                    }
                    setLoading(false);
                }
            );
        };
        loadPreferences();
    }, []);


    const handleToggle = (key: keyof ExtensionPreferences) => {
        const newPrefs = { ...prefs, [key]: !prefs[key] };
        setPrefs(newPrefs);

        // For on-page interaction settings, save to DB via background script
        if (key === 'enableSmartCapture' || key === 'enableSelectionMenu') {
            // Get current hostname for domain-specific save
            const hostname = new URL(window.location.href).hostname;
            chrome.runtime.sendMessage(
                { type: 'SET_DOMAIN_PREFERENCE', data: { domain: hostname, [key]: newPrefs[key] } },
                (response) => {
                    if (response?.success) {

                    } else {

                        savePreferences(newPrefs);
                    }
                }
            );
        } else {
            // Other settings (showSavedMark, showHighlights, shortcuts) stay in client storage
            savePreferences(newPrefs);
        }
    };


    if (loading) return null;

    return (
        <div className="space-y-4 py-2">

            {/* On-page Interactions Header */}
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-2 ml-1 mt-2">{t('settings.onPageInteractions')}</p>

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

            {/* Manual "Show Floating Button" removed as requested */}

            <div className="pt-2">
                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-3 ml-1">{t('settings.autoCheck')}</p>


                <div className="space-y-3">
                    {/* Show Saved Mark */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="w-5 h-5 text-zinc-500 flex items-center justify-center shrink-0"><BookmarkCheckIcon /></span>
                            <Label htmlFor="saved-mark" className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
                                {t('settings.showSavedMark')}
                            </Label>
                        </div>
                        <Switch
                            id="saved-mark"
                            checked={prefs.showSavedMark}
                            onCheckedChange={() => handleToggle('showSavedMark')}
                        />
                    </div>

                    {/* Show Highlights */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="w-5 h-5 text-zinc-500 flex items-center justify-center shrink-0"><HighlighterIcon /></span>
                            <Label htmlFor="show-highlights" className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
                                {t('settings.showHighlights')}
                            </Label>
                        </div>
                        <Switch
                            id="show-highlights"
                            checked={prefs.showHighlights}
                            onCheckedChange={() => handleToggle('showHighlights')}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
};
