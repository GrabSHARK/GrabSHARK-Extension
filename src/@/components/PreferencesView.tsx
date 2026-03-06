import { FC, useState, useEffect, useRef } from 'react';
import { X, CaretLeft, GearSix } from '@phosphor-icons/react';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeProvider';
import i18n from '../lib/i18n';
import { clearConfig } from '../lib/config';
import { CollectionPickerModal } from './CollectionPickerModal';
import { getPreferences, savePreferences } from '../lib/settings';
import { AppearanceSection } from './Preferences/AppearanceSection';
import { SavingSection } from './Preferences/SavingSection';
import { InteractionsSection } from './Preferences/InteractionsSection';
import { AccountSection } from './Preferences/AccountSection';
import { DisconnectDialog } from './Preferences/DisconnectDialog';

// Highlight color types
type HighlightColor = 'yellow' | 'red' | 'blue' | 'green';

type ExtensionDefaultCollection = 'UNORGANIZED' | 'LAST_USED' | 'SELECTED';

interface PreferencesViewProps {
    onClose: () => void;
    onBack: () => void;
}

export type LanguageSetting = 'en' | 'tr' | 'system';
export type ThemeSetting = 'dark' | 'light' | 'website' | 'system';

export const PreferencesView: FC<PreferencesViewProps> = ({ onClose, onBack }) => {
    const { t } = useTranslation();
    const { theme: currentTheme, setTheme: applyTheme } = useTheme();

    // Store original values on mount (for reverting on cancel)
    const originalTheme = useRef<ThemeSetting>(currentTheme as ThemeSetting);
    const originalLanguage = useRef<LanguageSetting>('en');
    const originalSaveDescription = useRef<boolean>(false);

    // Track current selections (for visual state and determining what to save)
    const [selectedTheme, setSelectedTheme] = useState<ThemeSetting>(currentTheme as ThemeSetting);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageSetting>('en');
    const [saveMetaDescriptionToNote, setSaveMetaDescriptionToNote] = useState<boolean>(false);
    const [extensionDefaultCollection, setExtensionDefaultCollection] = useState<ExtensionDefaultCollection>('UNORGANIZED');
    const [extensionSelectedCollectionId, setExtensionSelectedCollectionId] = useState<number | null>(null);
    const [selectedCollectionName, setSelectedCollectionName] = useState<string>('');
    const [defaultCollectionName, setDefaultCollectionName] = useState<string>('');
    const [defaultCollectionColor, setDefaultCollectionColor] = useState<string | null>(null);
    const [showCollectionPicker, setShowCollectionPicker] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [isClosingLanguageDropdown, setIsClosingLanguageDropdown] = useState(false);
    const [isClosingCollectionDropdown, setIsClosingCollectionDropdown] = useState(false);
    const [selectedCollectionColor, setSelectedCollectionColor] = useState<string | null>(null);

    // On-page interactions (global defaults)
    const [enableSmartCapture, setEnableSmartCapture] = useState(true);
    const [enableSelectionMenu, setEnableSelectionMenu] = useState(true);

    // Default highlight color
    const [defaultHighlightColor, setDefaultHighlightColor] = useState<HighlightColor>('yellow');
    const [showColorDropdown, setShowColorDropdown] = useState(false);
    const [isClosingColorDropdown, setIsClosingColorDropdown] = useState(false);

    // Save page on highlight
    const [savePageOnHighlight, setSavePageOnHighlight] = useState(true);

    // Original refs for cancel/revert
    const originalDefaultCollection = useRef<ExtensionDefaultCollection>('UNORGANIZED');
    const originalSelectedCollectionId = useRef<number | null>(null);
    const originalSmartCapture = useRef(true);
    const originalSelectionMenu = useRef(true);
    const originalHighlightColor = useRef<HighlightColor>('yellow');
    const originalSavePageOnHighlight = useRef(true);


    // Load language setting from storage on mount
    useEffect(() => {
        chrome.storage.local.get(['spark_locale', 'spark_locale_setting'], (result) => {
            const lang = (result.spark_locale_setting || result.spark_locale || 'en') as LanguageSetting;
            setSelectedLanguage(lang);
            originalLanguage.current = lang;
        });

        // Load user settings from API
        chrome.runtime.sendMessage({ type: 'GET_USER' }, (response) => {
            if (response?.success && response.data) {
                const saveDesc = response.data.saveMetaDescriptionToNote ?? false;
                setSaveMetaDescriptionToNote(saveDesc);
                originalSaveDescription.current = saveDesc;
                setUserId(response.data.id);

                // Load default collection settings
                const defCollection = response.data.extensionDefaultCollection ?? 'UNORGANIZED';
                setExtensionDefaultCollection(defCollection);
                originalDefaultCollection.current = defCollection;

                const selectedColId = response.data.extensionSelectedCollectionId ?? null;
                setExtensionSelectedCollectionId(selectedColId);
                originalSelectedCollectionId.current = selectedColId;

                // Load global on-page interaction prefs from User table
                const globalSmartCapture = response.data.globalEnableSmartCapture ?? true;
                const globalSelectionMenu = response.data.globalEnableSelectionMenu ?? true;
                setEnableSmartCapture(globalSmartCapture);
                setEnableSelectionMenu(globalSelectionMenu);
                originalSmartCapture.current = globalSmartCapture;
                originalSelectionMenu.current = globalSelectionMenu;


                // Fetch collection names from API
                chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' }, (colResponse) => {
                    if (colResponse?.success && colResponse.data) {
                        const collections = Array.isArray(colResponse.data)
                            ? colResponse.data
                            : (colResponse.data.response || []);

                        // Always resolve the default (Unorganized) collection's real name
                        const defaultCol = collections.find((c: any) => c.isDefault === true);
                        if (defaultCol) {
                            setDefaultCollectionName(defaultCol.name);
                            setDefaultCollectionColor(defaultCol.color || null);
                        }

                        // If SELECTED mode, also resolve the selected collection's name
                        if (selectedColId && defCollection === 'SELECTED') {
                            const col = collections.find((c: any) => c.id === selectedColId);
                            if (col) {
                                setSelectedCollectionName(col.name);
                                setSelectedCollectionColor(col.color || null);
                            }
                        }
                    }
                });
            }
        });

        // Load default highlight color + savePageOnHighlight from local preferences
        getPreferences().then((prefs) => {
            const color = prefs.defaultHighlightColor || 'yellow';
            setDefaultHighlightColor(color);
            originalHighlightColor.current = color;

            const savePage = prefs.savePageOnHighlight ?? true;
            setSavePageOnHighlight(savePage);
            originalSavePageOnHighlight.current = savePage;
        });
    }, []);



    // Handle theme change - APPLY INSTANTLY for preview
    const handleThemeChange = (theme: ThemeSetting) => {
        setSelectedTheme(theme);
        applyTheme(theme); // Instant visual feedback
    };

    // Handle language change - APPLY INSTANTLY for preview
    const handleLanguageChange = (lang: LanguageSetting) => {
        setSelectedLanguage(lang);
        // Instant visual feedback
        if (lang === 'system') {
            chrome.runtime.sendMessage({ type: 'SYNC_USER_LOCALE' }, (response) => {
                if (response?.success && response.locale) {
                    i18n.changeLanguage(response.locale);
                }
            });
        } else {
            i18n.changeLanguage(lang);
        }
    };

    // Handle Done - SAVE changes to storage, then close
    const handleSave = async () => {
        // Save theme if changed
        if (selectedTheme !== originalTheme.current) {
            // Theme is already applied visually, just need to persist via setTheme's internal storage
            // setTheme already handles localStorage, so the current theme is already saved
        }

        // Save language if changed
        if (selectedLanguage !== originalLanguage.current) {
            if (selectedLanguage === 'system') {
                await chrome.storage.local.set({ spark_locale_setting: 'system' });
            } else {
                await chrome.storage.local.set({
                    spark_locale: selectedLanguage,
                    spark_locale_setting: selectedLanguage
                });
            }
        }

        // Save server-side preferences if changed
        const serverPrefsChanged =
            saveMetaDescriptionToNote !== originalSaveDescription.current ||
            extensionDefaultCollection !== originalDefaultCollection.current ||
            extensionSelectedCollectionId !== originalSelectedCollectionId.current;

        if (serverPrefsChanged && userId) {
            try {
                const updateData: any = {};

                if (saveMetaDescriptionToNote !== originalSaveDescription.current) {
                    updateData.saveMetaDescriptionToNote = saveMetaDescriptionToNote;
                }
                if (extensionDefaultCollection !== originalDefaultCollection.current) {
                    updateData.extensionDefaultCollection = extensionDefaultCollection;
                }
                if (extensionSelectedCollectionId !== originalSelectedCollectionId.current) {
                    updateData.extensionSelectedCollectionId = extensionSelectedCollectionId;
                }



                const response = await chrome.runtime.sendMessage({
                    type: 'UPDATE_USER',
                    data: {
                        userId: userId,
                        data: updateData
                    }
                });

                if (response?.success) {

                } else {

                }
            } catch (e) {

            }
        }

        // Save local preferences (on-page interactions + default highlight color + savePageOnHighlight) in a SINGLE atomic save
        const onPagePrefsChanged =
            enableSmartCapture !== originalSmartCapture.current ||
            enableSelectionMenu !== originalSelectionMenu.current;
        const colorChanged = defaultHighlightColor !== originalHighlightColor.current;
        const savePageChanged = savePageOnHighlight !== originalSavePageOnHighlight.current;

        // Single atomic save for ALL local preferences
        if (onPagePrefsChanged || colorChanged || savePageChanged) {
            const currentPrefs = await getPreferences();
            await savePreferences({
                ...currentPrefs,
                enableSmartCapture,
                enableSelectionMenu,
                defaultHighlightColor,
                savePageOnHighlight
            });
        }

        // Save to User table (for domain preference comparison) - separate from local storage
        if (onPagePrefsChanged && userId) {
            try {

                const response = await chrome.runtime.sendMessage({
                    type: 'UPDATE_USER',
                    data: {
                        userId: userId,
                        data: {
                            globalEnableSmartCapture: enableSmartCapture,
                            globalEnableSelectionMenu: enableSelectionMenu
                        }
                    }
                });

                if (response?.success) {

                } else {

                }
            } catch (e) {

            }
        }

        // Notify all content scripts about preference changes
        try {
            chrome.runtime.sendMessage({
                type: 'BROADCAST_PREFERENCES_UPDATED',
                data: {
                    defaultHighlightColor,
                    enableSmartCapture,
                    enableSelectionMenu
                }
            });

        } catch (e) {

        }

        onBack(); // Close the preferences panel

    };

    // Handle Back/Cancel - close card first, THEN revert after animation
    const handleCancel = () => {
        const needsThemeRevert = selectedTheme !== originalTheme.current;
        const needsLanguageRevert = selectedLanguage !== originalLanguage.current;

        // Close the card first (keeps current visual state during close animation)
        onBack();

        // After card closes (allow 350ms for transition), revert to original values
        if (needsThemeRevert || needsLanguageRevert) {
            setTimeout(() => {
                if (needsThemeRevert) {
                    applyTheme(originalTheme.current);
                }
                if (needsLanguageRevert) {
                    if (originalLanguage.current === 'system') {
                        chrome.runtime.sendMessage({ type: 'SYNC_USER_LOCALE' }, (response) => {
                            if (response?.success && response.locale) {
                                i18n.changeLanguage(response.locale);
                            }
                        });
                    } else {
                        i18n.changeLanguage(originalLanguage.current);
                    }
                }
            }, 300);
        }
    };

    // Handle Dropdown Close with Animation
    const closeLanguageDropdown = (callback?: () => void) => {
        setIsClosingLanguageDropdown(true);
        setTimeout(() => {
            setShowLanguageDropdown(false);
            setIsClosingLanguageDropdown(false);
            callback?.();
        }, 150);
    };

    const closeCollectionDropdown = (callback?: () => void) => {
        setIsClosingCollectionDropdown(true);
        setTimeout(() => {
            setShowCollectionDropdown(false);
            setIsClosingCollectionDropdown(false);
            callback?.();
        }, 150);
    };

    const closeColorDropdown = (callback?: () => void) => {
        setIsClosingColorDropdown(true);
        setTimeout(() => {
            setShowColorDropdown(false);
            setIsClosingColorDropdown(false);
            callback?.();
        }, 150);
    };


    // Handle Disconnect
    const handleDisconnect = async () => {
        await clearConfig();
        window.location.reload(); // Force reload to clear state and show login
    };

    return (
        <div className="flex flex-col h-full p-4 relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 rounded-full p-1.5 shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                        <GearSix className="w-3.5 h-3.5 text-white" weight="bold" />
                    </div>
                    <span className="font-semibold text-base text-zinc-800 dark:text-zinc-200">
                        {t('preferences.title')}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCancel}
                        className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500"
                        title={t('common.back')}
                    >
                        <CaretLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-5 pr-1">

                <AppearanceSection
                    selectedTheme={selectedTheme}
                    onThemeChange={handleThemeChange}
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={handleLanguageChange}
                    showLanguageDropdown={showLanguageDropdown}
                    setShowLanguageDropdown={setShowLanguageDropdown}
                    isClosingLanguageDropdown={isClosingLanguageDropdown}
                    onCloseLanguageDropdown={closeLanguageDropdown}
                />

                <SavingSection
                    saveMetaDescriptionToNote={saveMetaDescriptionToNote}
                    setSaveMetaDescriptionToNote={setSaveMetaDescriptionToNote}
                    extensionDefaultCollection={extensionDefaultCollection}
                    setExtensionDefaultCollection={setExtensionDefaultCollection}
                    selectedCollectionName={selectedCollectionName}
                    selectedCollectionColor={selectedCollectionColor}
                    defaultCollectionName={defaultCollectionName}
                    defaultCollectionColor={defaultCollectionColor}
                    showCollectionDropdown={showCollectionDropdown}
                    setShowCollectionDropdown={setShowCollectionDropdown}
                    isClosingCollectionDropdown={isClosingCollectionDropdown}
                    onCloseCollectionDropdown={closeCollectionDropdown}
                    onResetCollection={() => {
                        setExtensionDefaultCollection('UNORGANIZED');
                        setExtensionSelectedCollectionId(null);
                        setSelectedCollectionName('');
                        setSelectedCollectionColor(null);
                    }}
                    onOpenCollectionPicker={() => setShowCollectionPicker(true)}
                    defaultHighlightColor={defaultHighlightColor}
                    setDefaultHighlightColor={setDefaultHighlightColor}
                    showColorDropdown={showColorDropdown}
                    setShowColorDropdown={setShowColorDropdown}
                    isClosingColorDropdown={isClosingColorDropdown}
                    onCloseColorDropdown={closeColorDropdown}
                    savePageOnHighlight={savePageOnHighlight}
                    setSavePageOnHighlight={setSavePageOnHighlight}
                />

                <InteractionsSection
                    enableSmartCapture={enableSmartCapture}
                    setEnableSmartCapture={setEnableSmartCapture}
                    enableSelectionMenu={enableSelectionMenu}
                    setEnableSelectionMenu={setEnableSelectionMenu}
                />

                <AccountSection onShowDisconnect={() => setShowDisconnectConfirm(true)} />

            </div>

            {/* Done Button - Fixed at bottom */}
            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                    onClick={handleSave}
                    className="w-full h-11 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_rgba(37,99,235,0.45)] transition-all duration-300"
                >
                    {t('common.done')}
                </Button>
            </div>

            {/* Collection Picker Modal */}
            <CollectionPickerModal
                isOpen={showCollectionPicker}
                onClose={() => setShowCollectionPicker(false)}
                selectedCollectionId={extensionSelectedCollectionId}
                onSelect={(collection) => {
                    setExtensionDefaultCollection('SELECTED');
                    setExtensionSelectedCollectionId(collection.id);
                    setSelectedCollectionName(collection.name);
                    setSelectedCollectionColor(collection.color || null);
                    setShowCollectionPicker(false);
                }}
            />

            <DisconnectDialog
                isOpen={showDisconnectConfirm}
                onClose={() => setShowDisconnectConfirm(false)}
                onDisconnect={() => {
                    handleDisconnect();
                    setShowDisconnectConfirm(false);
                }}
            />
        </div>
    );
};
