import { FC, useState, useEffect, useRef, useCallback } from 'react';
import { X, CaretLeft, GearSix } from '@phosphor-icons/react';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeProvider';
import i18n, { setExtensionLanguage } from '../lib/i18n';
import { clearConfig } from '../lib/config';
import { CollectionPickerModal } from './CollectionPickerModal';
import { getPreferences, savePreferences } from '../lib/settings';
import { AppearanceSection } from './Preferences/AppearanceSection';
import { SavingSection } from './Preferences/SavingSection';
import { InteractionsSection } from './Preferences/InteractionsSection';
import { AccountSection } from './Preferences/AccountSection';
import { DisconnectDialog } from './Preferences/DisconnectDialog';
import { getExtensionBootstrapState } from '../lib/actions/bootstrap';
import {
    broadcastPreferencesUpdated,
    getLocaleSettings,
    saveLocaleSettings,
    syncUserLocale,
    updateCurrentUserProfile,
} from '../lib/runtime/messages';

type HighlightColor = 'yellow' | 'red' | 'blue' | 'green';
type ExtensionDefaultCollection = 'UNORGANIZED' | 'LAST_USED' | 'SELECTED';

interface PreferencesViewProps { onClose: () => void; onBack: () => void; }

export type LanguageSetting = 'en' | 'tr' | 'system';
export type ThemeSetting = 'dark' | 'light' | 'website' | 'system';

function usePreferencesSave(args: {
    selectedTheme: ThemeSetting; selectedLanguage: LanguageSetting; saveMetaDescriptionToNote: boolean;
    extensionDefaultCollection: string; extensionSelectedCollectionId: number | null;
    enableSmartCapture: boolean; enableSelectionMenu: boolean; defaultHighlightColor: string;
    savePageOnHighlight: boolean; userId: number | null; onBack: () => void;
}) {
    const { theme: currentTheme, setTheme: applyTheme } = useTheme();
    const originalTheme = useRef<ThemeSetting>(currentTheme as ThemeSetting);
    const originalLanguage = useRef<LanguageSetting>('en');
    const originalSaveDescription = useRef<boolean>(false);
    const originalDefaultCollection = useRef<string>('UNORGANIZED');
    const originalSelectedCollectionId = useRef<number | null>(null);
    const originalSmartCapture = useRef(true);
    const originalSelectionMenu = useRef(true);
    const originalHighlightColor = useRef<string>('yellow');
    const originalSavePageOnHighlight = useRef(true);

    const setOriginals = useCallback((data: {
        language: LanguageSetting; saveDesc: boolean; defCollection: string; selectedColId: number | null;
        smartCapture: boolean; selectionMenu: boolean; highlightColor: string; savePageOnHighlight: boolean;
    }) => {
        originalLanguage.current = data.language;
        originalSaveDescription.current = data.saveDesc;
        originalDefaultCollection.current = data.defCollection;
        originalSelectedCollectionId.current = data.selectedColId;
        originalSmartCapture.current = data.smartCapture;
        originalSelectionMenu.current = data.selectionMenu;
        originalHighlightColor.current = data.highlightColor;
        originalSavePageOnHighlight.current = data.savePageOnHighlight;
    }, []);

    const handleSave = async () => {
        const {
            selectedLanguage, saveMetaDescriptionToNote, extensionDefaultCollection,
            extensionSelectedCollectionId, enableSmartCapture, enableSelectionMenu,
            defaultHighlightColor, savePageOnHighlight, userId, onBack,
        } = args;

        if (selectedLanguage !== originalLanguage.current) {
            await saveLocaleSettings({
                localeSetting: selectedLanguage,
                locale: selectedLanguage === 'system' ? i18n.language : selectedLanguage,
            });
        }

        const updateData: Record<string, unknown> = {};
        if (saveMetaDescriptionToNote !== originalSaveDescription.current) updateData.saveMetaDescriptionToNote = saveMetaDescriptionToNote;
        if (extensionDefaultCollection !== originalDefaultCollection.current) updateData.extensionDefaultCollection = extensionDefaultCollection;
        if (extensionSelectedCollectionId !== originalSelectedCollectionId.current) updateData.extensionSelectedCollectionId = extensionSelectedCollectionId;
        if (enableSmartCapture !== originalSmartCapture.current) updateData.globalEnableSmartCapture = enableSmartCapture;
        if (enableSelectionMenu !== originalSelectionMenu.current) updateData.globalEnableSelectionMenu = enableSelectionMenu;

        if (Object.keys(updateData).length > 0 && userId) {
            try {
                await updateCurrentUserProfile(userId, updateData);
            } catch {
            }
        }

        const onPageChanged = enableSmartCapture !== originalSmartCapture.current || enableSelectionMenu !== originalSelectionMenu.current;
        const colorChanged = defaultHighlightColor !== originalHighlightColor.current;
        const savePageChanged = savePageOnHighlight !== originalSavePageOnHighlight.current;

        if (onPageChanged || colorChanged || savePageChanged) {
            const currentPrefs = await getPreferences();
            await savePreferences({ ...currentPrefs, enableSmartCapture, enableSelectionMenu, defaultHighlightColor, savePageOnHighlight } as any);
        }

        try {
            await broadcastPreferencesUpdated({ defaultHighlightColor, enableSmartCapture, enableSelectionMenu });
        } catch {
        }

        onBack();
    };

    const handleCancel = () => {
        const needsThemeRevert = args.selectedTheme !== originalTheme.current;
        const needsLanguageRevert = args.selectedLanguage !== originalLanguage.current;
        args.onBack();

        if (needsThemeRevert || needsLanguageRevert) {
            setTimeout(() => {
                if (needsThemeRevert) applyTheme(originalTheme.current);
                if (needsLanguageRevert) {
                    if (originalLanguage.current === 'system') {
                        void syncUserLocale().then((result) => {
                            if (result?.locale) void setExtensionLanguage(result.locale);
                        }).catch(() => { });
                    } else {
                        void setExtensionLanguage(originalLanguage.current);
                    }
                }
            }, 300);
        }
    };

    return { handleSave, handleCancel, setOriginals, originalTheme };
}

export const PreferencesView: FC<PreferencesViewProps> = ({ onClose, onBack }) => {
    const { t } = useTranslation();
    const { theme: currentTheme, setTheme: applyTheme } = useTheme();

    const [selectedTheme, setSelectedTheme] = useState<ThemeSetting>(currentTheme as ThemeSetting);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageSetting>('en');
    const [saveMetaDescriptionToNote, setSaveMetaDescriptionToNote] = useState(false);
    const [extensionDefaultCollection, setExtensionDefaultCollection] = useState<ExtensionDefaultCollection>('UNORGANIZED');
    const [extensionSelectedCollectionId, setExtensionSelectedCollectionId] = useState<number | null>(null);
    const [selectedCollectionName, setSelectedCollectionName] = useState('');
    const [defaultCollectionName, setDefaultCollectionName] = useState('');
    const [defaultCollectionColor, setDefaultCollectionColor] = useState<string | null>(null);
    const [showCollectionPicker, setShowCollectionPicker] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [isClosingLanguageDropdown, setIsClosingLanguageDropdown] = useState(false);
    const [isClosingCollectionDropdown, setIsClosingCollectionDropdown] = useState(false);
    const [selectedCollectionColor, setSelectedCollectionColor] = useState<string | null>(null);
    const [enableSmartCapture, setEnableSmartCapture] = useState(true);
    const [enableSelectionMenu, setEnableSelectionMenu] = useState(true);
    const [defaultHighlightColor, setDefaultHighlightColor] = useState<HighlightColor>('yellow');
    const [showColorDropdown, setShowColorDropdown] = useState(false);
    const [isClosingColorDropdown, setIsClosingColorDropdown] = useState(false);
    const [savePageOnHighlight, setSavePageOnHighlight] = useState(true);

    const { handleSave, handleCancel, setOriginals } = usePreferencesSave({
        selectedTheme, selectedLanguage, saveMetaDescriptionToNote, extensionDefaultCollection,
        extensionSelectedCollectionId, enableSmartCapture, enableSelectionMenu, defaultHighlightColor,
        savePageOnHighlight, userId, onBack,
    });

    useEffect(() => {
        let active = true;

        const loadInitialState = async () => {
            try {
                const [localeSettings, bootstrap, prefs] = await Promise.all([
                    getLocaleSettings(),
                    getExtensionBootstrapState(),
                    getPreferences(),
                ]);

                if (!active) return;

                const lang = (localeSettings.localeSetting || localeSettings.locale || 'en') as LanguageSetting;
                setSelectedLanguage(lang);

                const user = bootstrap.user || {};
                const collections = bootstrap.collections || [];
                const defCol = (user.extensionDefaultCollection ?? 'UNORGANIZED') as ExtensionDefaultCollection;
                const selColId = user.extensionSelectedCollectionId ?? null;
                const sc = user.globalEnableSmartCapture ?? true;
                const sm = user.globalEnableSelectionMenu ?? true;

                setSaveMetaDescriptionToNote(user.saveMetaDescriptionToNote ?? false);
                setUserId(user.id ?? null);
                setExtensionDefaultCollection(defCol);
                setExtensionSelectedCollectionId(selColId);
                setEnableSmartCapture(sc);
                setEnableSelectionMenu(sm);
                setDefaultHighlightColor((prefs.defaultHighlightColor || 'yellow') as HighlightColor);
                setSavePageOnHighlight(prefs.savePageOnHighlight ?? true);

                const defaultCol = collections.find((c: any) => c.isDefault === true);
                if (defaultCol) {
                    setDefaultCollectionName(defaultCol.name);
                    setDefaultCollectionColor(defaultCol.color || null);
                }

                if (selColId && defCol === 'SELECTED') {
                    const selectedCollection = collections.find((c: any) => c.id === selColId);
                    if (selectedCollection) {
                        setSelectedCollectionName(selectedCollection.name);
                        setSelectedCollectionColor(selectedCollection.color || null);
                    }
                }

                setOriginals({
                    language: lang,
                    saveDesc: user.saveMetaDescriptionToNote ?? false,
                    defCollection: defCol,
                    selectedColId: selColId,
                    smartCapture: sc,
                    selectionMenu: sm,
                    highlightColor: prefs.defaultHighlightColor || 'yellow',
                    savePageOnHighlight: prefs.savePageOnHighlight ?? true,
                });
            } catch {
            }
        };

        void loadInitialState();
        return () => { active = false; };
    }, [setOriginals]);

    const handleThemeChange = (theme: ThemeSetting) => { setSelectedTheme(theme); applyTheme(theme); };
    const handleLanguageChange = (lang: LanguageSetting) => {
        setSelectedLanguage(lang);
        if (lang === 'system') {
            void syncUserLocale().then((result) => {
                if (result?.locale) void setExtensionLanguage(result.locale);
            }).catch(() => { });
        } else {
            void setExtensionLanguage(lang);
        }
    };

    const closeLanguageDropdown = (cb?: () => void) => { setIsClosingLanguageDropdown(true); setTimeout(() => { setShowLanguageDropdown(false); setIsClosingLanguageDropdown(false); cb?.(); }, 150); };
    const closeCollectionDropdown = (cb?: () => void) => { setIsClosingCollectionDropdown(true); setTimeout(() => { setShowCollectionDropdown(false); setIsClosingCollectionDropdown(false); cb?.(); }, 150); };
    const closeColorDropdown = (cb?: () => void) => { setIsClosingColorDropdown(true); setTimeout(() => { setShowColorDropdown(false); setIsClosingColorDropdown(false); cb?.(); }, 150); };

    return (
        <div className="flex flex-col h-full p-4 relative">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 rounded-full p-1.5 shadow-[0_0_12px_rgba(59,130,246,0.5)]"><GearSix className="w-3.5 h-3.5 text-white" weight="bold" /></div>
                    <span className="font-semibold text-base text-zinc-800 dark:text-zinc-200">{t('preferences.title')}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handleCancel} className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500" title={t('common.back')}><CaretLeft className="w-4 h-4" /></button>
                    <button onClick={onClose} className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500"><X className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-5 pr-1">
                <AppearanceSection selectedTheme={selectedTheme} onThemeChange={handleThemeChange} selectedLanguage={selectedLanguage} onLanguageChange={handleLanguageChange}
                    showLanguageDropdown={showLanguageDropdown} setShowLanguageDropdown={setShowLanguageDropdown} isClosingLanguageDropdown={isClosingLanguageDropdown} onCloseLanguageDropdown={closeLanguageDropdown} />
                <SavingSection saveMetaDescriptionToNote={saveMetaDescriptionToNote} setSaveMetaDescriptionToNote={setSaveMetaDescriptionToNote}
                    extensionDefaultCollection={extensionDefaultCollection} setExtensionDefaultCollection={setExtensionDefaultCollection}
                    selectedCollectionName={selectedCollectionName} selectedCollectionColor={selectedCollectionColor} defaultCollectionName={defaultCollectionName} defaultCollectionColor={defaultCollectionColor}
                    showCollectionDropdown={showCollectionDropdown} setShowCollectionDropdown={setShowCollectionDropdown} isClosingCollectionDropdown={isClosingCollectionDropdown}
                    onCloseCollectionDropdown={closeCollectionDropdown}
                    onResetCollection={() => { setExtensionDefaultCollection('UNORGANIZED'); setExtensionSelectedCollectionId(null); setSelectedCollectionName(''); setSelectedCollectionColor(null); }}
                    onOpenCollectionPicker={() => setShowCollectionPicker(true)}
                    defaultHighlightColor={defaultHighlightColor} setDefaultHighlightColor={setDefaultHighlightColor}
                    showColorDropdown={showColorDropdown} setShowColorDropdown={setShowColorDropdown} isClosingColorDropdown={isClosingColorDropdown} onCloseColorDropdown={closeColorDropdown}
                    savePageOnHighlight={savePageOnHighlight} setSavePageOnHighlight={setSavePageOnHighlight} />
                <InteractionsSection enableSmartCapture={enableSmartCapture} setEnableSmartCapture={setEnableSmartCapture} enableSelectionMenu={enableSelectionMenu} setEnableSelectionMenu={setEnableSelectionMenu} />
                <AccountSection onShowDisconnect={() => setShowDisconnectConfirm(true)} />
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <Button onClick={() => void handleSave()} className="w-full h-11 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_rgba(37,99,235,0.45)] transition-all duration-300">{t('common.done')}</Button>
            </div>

            <CollectionPickerModal isOpen={showCollectionPicker} onClose={() => setShowCollectionPicker(false)} selectedCollectionId={extensionSelectedCollectionId}
                onSelect={(collection) => { setExtensionDefaultCollection('SELECTED'); setExtensionSelectedCollectionId(collection.id); setSelectedCollectionName(collection.name); setSelectedCollectionColor(collection.color || null); setShowCollectionPicker(false); }} />
            <DisconnectDialog isOpen={showDisconnectConfirm} onClose={() => setShowDisconnectConfirm(false)}
                onDisconnect={() => { clearConfig().then(() => window.location.reload()); setShowDisconnectConfirm(false); }} />
        </div>
    );
};


