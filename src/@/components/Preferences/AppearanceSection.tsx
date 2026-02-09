import { FC } from 'react';
import { Moon, Sun, Monitor, Link } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils'; // Adjust path if needed
// Use imported types directly
import { ThemeSetting, LanguageSetting } from '../PreferencesView';

interface AppearanceSectionProps {
    selectedTheme: ThemeSetting;
    onThemeChange: (theme: ThemeSetting) => void;
    selectedLanguage: LanguageSetting;
    onLanguageChange: (lang: LanguageSetting) => void;
    showLanguageDropdown: boolean;
    setShowLanguageDropdown: (show: boolean) => void;
    isClosingLanguageDropdown: boolean;
    onCloseLanguageDropdown: (callback?: () => void) => void;
}

export const AppearanceSection: FC<AppearanceSectionProps> = ({
    selectedTheme,
    onThemeChange,
    selectedLanguage,
    onLanguageChange,
    showLanguageDropdown,
    setShowLanguageDropdown,
    isClosingLanguageDropdown,
    onCloseLanguageDropdown,
}) => {
    const { t } = useTranslation();

    return (
        <section>
            <h3 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-3">
                {t('preferences.appearance')}
            </h3>

            {/* Theme Row */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{t('preferences.theme')}</span>
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5">
                    <button
                        onClick={() => onThemeChange('dark')}
                        title={t('preferences.themeDark')}
                        className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                            selectedTheme === 'dark'
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        <Moon className="w-4 h-4" weight={selectedTheme === 'dark' ? 'fill' : 'regular'} />
                    </button>
                    <button
                        onClick={() => onThemeChange('light')}
                        title={t('preferences.themeLight')}
                        className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                            selectedTheme === 'light'
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        <Sun className="w-4 h-4" weight={selectedTheme === 'light' ? 'fill' : 'regular'} />
                    </button>
                    <button
                        onClick={() => onThemeChange('system')}
                        title={t('preferences.themeSystem')}
                        className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                            selectedTheme === 'system'
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        <Monitor className="w-4 h-4" weight={selectedTheme === 'system' ? 'fill' : 'regular'} />
                    </button>
                    <button
                        onClick={() => onThemeChange('website')}
                        title={t('preferences.themeWebsite')}
                        className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                            selectedTheme === 'website'
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        <Link className="w-4 h-4" weight={selectedTheme === 'website' ? 'fill' : 'regular'} />
                    </button>
                </div>
            </div>

            {/* Language Row - Dropdown + Auto */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{t('preferences.language')}</span>
                <div className="flex items-center gap-1">
                    {/* Language Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-medium transition-all bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                            <span>{selectedLanguage === 'en' ? 'EN' : selectedLanguage === 'tr' ? 'TR' : 'EN'}</span>
                            <svg className={cn("w-3 h-3 transition-transform", showLanguageDropdown && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* Language Dropdown Menu */}
                        {showLanguageDropdown && (
                            <div
                                className={cn(
                                    "absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-1 z-10 transition-all duration-150",
                                    isClosingLanguageDropdown ? "opacity-0 scale-95" : "opacity-100 scale-100 animate-in fade-in slide-in-from-top-1 duration-150"
                                )}
                            >
                                {selectedLanguage !== 'en' && (
                                    <button
                                        onClick={() => onCloseLanguageDropdown(() => onLanguageChange('en'))}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <span>🇺🇸</span>
                                        <span>English</span>
                                    </button>
                                )}
                                {selectedLanguage !== 'tr' && (
                                    <button
                                        onClick={() => onCloseLanguageDropdown(() => onLanguageChange('tr'))}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        style={{ borderRadius: '8px' }}
                                    >
                                        <span>🇹🇷</span>
                                        <span>Türkçe</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Auto Button */}
                    <button
                        onClick={() => onLanguageChange('system')}
                        title={t('preferences.languageSystem')}
                        className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                            selectedLanguage === 'system'
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        <Link className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </section>
    );
};
