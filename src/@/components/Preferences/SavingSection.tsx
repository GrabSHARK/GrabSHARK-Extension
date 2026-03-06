import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../ui/Switch';
import { Folder, FolderSimple, ClockCounterClockwise } from '@phosphor-icons/react';
import { cn } from '../../lib/utils';

// Highlight color types
type HighlightColor = 'yellow' | 'red' | 'blue' | 'green';
const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'red', 'blue', 'green'];
const COLOR_VALUES: Record<HighlightColor, string> = {
    yellow: '#fef08a',
    red: '#fca5a5',
    blue: '#93c5fd',
    green: '#86efac',
};

type ExtensionDefaultCollection = 'UNORGANIZED' | 'LAST_USED' | 'SELECTED';

interface SavingSectionProps {
    saveMetaDescriptionToNote: boolean;
    setSaveMetaDescriptionToNote: (checked: boolean) => void;
    extensionDefaultCollection: ExtensionDefaultCollection;
    setExtensionDefaultCollection: (col: ExtensionDefaultCollection) => void;
    selectedCollectionName: string;
    selectedCollectionColor: string | null;
    defaultCollectionName: string;
    defaultCollectionColor: string | null;
    showCollectionDropdown: boolean;
    setShowCollectionDropdown: (show: boolean) => void;
    isClosingCollectionDropdown: boolean;
    onCloseCollectionDropdown: (callback?: () => void) => void;
    onResetCollection: () => void;
    onOpenCollectionPicker: () => void;
    defaultHighlightColor: HighlightColor;
    setDefaultHighlightColor: (color: HighlightColor) => void;
    showColorDropdown: boolean;
    setShowColorDropdown: (show: boolean) => void;
    isClosingColorDropdown: boolean;
    onCloseColorDropdown: (callback?: () => void) => void;
    savePageOnHighlight: boolean;
    setSavePageOnHighlight: (checked: boolean) => void;
}

export const SavingSection: FC<SavingSectionProps> = ({
    saveMetaDescriptionToNote,
    setSaveMetaDescriptionToNote,
    extensionDefaultCollection,
    setExtensionDefaultCollection,
    selectedCollectionName,
    selectedCollectionColor,
    defaultCollectionName,
    defaultCollectionColor,
    showCollectionDropdown,
    setShowCollectionDropdown,
    isClosingCollectionDropdown,
    onCloseCollectionDropdown,
    onResetCollection,
    onOpenCollectionPicker,
    defaultHighlightColor,
    setDefaultHighlightColor,
    showColorDropdown,
    setShowColorDropdown,
    isClosingColorDropdown,
    onCloseColorDropdown,
    savePageOnHighlight,
    setSavePageOnHighlight,
}) => {
    const { t } = useTranslation();

    return (
        <section>
            <h3 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-3">
                {t('preferences.saving')}
            </h3>

            {/* Save description to note */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {t('preferences.saveDescriptionToNote')}
                </span>
                <Switch
                    checked={saveMetaDescriptionToNote}
                    onCheckedChange={(checked) => setSaveMetaDescriptionToNote(checked)}
                />
            </div>

            {/* Default Collection Dropdown */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {t('preferences.defaultCollection')}
                </span>
                <div className="relative">
                    <button
                        onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        {extensionDefaultCollection === 'UNORGANIZED' && (
                            <>
                                <FolderSimple className="w-4 h-4" weight="fill" style={{ color: defaultCollectionColor || '#0ea5e9' }} />
                                <span>{defaultCollectionName || t('preferences.unorganized')}</span>
                            </>
                        )}
                        {extensionDefaultCollection === 'LAST_USED' && (
                            <>
                                <ClockCounterClockwise className="w-4 h-4 text-zinc-500" />
                                <span>{t('preferences.lastUsed')}</span>
                            </>
                        )}
                        {extensionDefaultCollection === 'SELECTED' && (
                            <>
                                <Folder
                                    className="w-4 h-4"
                                    weight="fill"
                                    style={{ color: selectedCollectionColor || undefined }}
                                />
                                <span>{selectedCollectionName || t('preferences.selectCollection')}</span>
                            </>
                        )}
                        <svg className={cn("w-3 h-3 text-zinc-400 transition-transform", showCollectionDropdown && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showCollectionDropdown && (
                        <div
                            className={cn(
                                "absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-1 z-10 transition-all duration-150",
                                isClosingCollectionDropdown ? "opacity-0 scale-95" : "opacity-100 scale-100 animate-in fade-in slide-in-from-top-1 duration-150"
                            )}
                        >
                            {extensionDefaultCollection !== 'UNORGANIZED' && (
                                <button
                                    onClick={() => onCloseCollectionDropdown(onResetCollection)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <FolderSimple className="w-4 h-4" weight="fill" style={{ color: defaultCollectionColor || '#0ea5e9' }} />
                                    <span>{defaultCollectionName || t('preferences.unorganized')}</span>
                                </button>
                            )}
                            {extensionDefaultCollection !== 'LAST_USED' && (
                                <button
                                    onClick={() => onCloseCollectionDropdown(() => setExtensionDefaultCollection('LAST_USED'))}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <ClockCounterClockwise className="w-4 h-4" />
                                    <span>{t('preferences.lastUsed')}</span>
                                </button>
                            )}
                            {extensionDefaultCollection !== 'SELECTED' && (
                                <button
                                    onClick={() => onCloseCollectionDropdown(onOpenCollectionPicker)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <Folder className="w-4 h-4" weight="fill" />
                                    <span>{t('preferences.selectCollection')}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Default Color Dropdown */}
            <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {t('preferences.defaultColor')}
                </span>
                <div className="relative">
                    <button
                        onClick={() => setShowColorDropdown(!showColorDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLOR_VALUES[defaultHighlightColor] }}
                        />
                        <span>{t(`preferences.color${defaultHighlightColor.charAt(0).toUpperCase() + defaultHighlightColor.slice(1)}`)}</span>
                        <svg className={cn("w-3 h-3 text-zinc-400 transition-transform", showColorDropdown && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Color Dropdown Menu */}
                    {showColorDropdown && (
                        <div
                            className={cn(
                                "absolute right-0 top-full mt-1 w-36 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-1 z-10 transition-all duration-150",
                                isClosingColorDropdown ? "opacity-0 scale-95" : "opacity-100 scale-100 animate-in fade-in slide-in-from-top-1 duration-150"
                            )}
                        >
                            {HIGHLIGHT_COLORS.filter(c => c !== defaultHighlightColor).map(color => (
                                <button
                                    key={color}
                                    onClick={() => onCloseColorDropdown(() => setDefaultHighlightColor(color))}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    style={{ borderRadius: '8px' }}
                                >
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: COLOR_VALUES[color] }}
                                    />
                                    <span>{t(`preferences.color${color.charAt(0).toUpperCase() + color.slice(1)}`)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Save page on highlight */}
            <div className="flex items-center justify-between mt-3">
                <div className="flex flex-col">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {t('preferences.savePageOnHighlight')}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {t('preferences.savePageOnHighlightDesc')}
                    </span>
                </div>
                <Switch
                    checked={savePageOnHighlight}
                    onCheckedChange={(checked) => setSavePageOnHighlight(checked)}
                />
            </div>
        </section>
    );
};
