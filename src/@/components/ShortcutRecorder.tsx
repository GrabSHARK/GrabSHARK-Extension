import { useState, useEffect, useRef } from 'react';
import {
    PencilSimple,
    Command,
    Option,
    ArrowUp, // Shift
    CaretUp, // Control
    ArrowElbowDownLeft, // Enter
    Backspace, // Backspace
    ArrowRight // Tab
} from '@phosphor-icons/react';
import { ShortcutConfig } from '../lib/settings';
import { useTranslation } from 'react-i18next';

// Modifier key names
const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta'];

interface ShortcutRecorderProps {
    config: ShortcutConfig;
    onChange: (config: ShortcutConfig) => void;
}

export const ShortcutRecorder = ({ config, onChange }: ShortcutRecorderProps) => {
    const { t, i18n } = useTranslation();
    const [isRecording, setIsRecording] = useState(false);
    const [pressedModifiers, setPressedModifiers] = useState<{
        ctrl: boolean;
        shift: boolean;
        alt: boolean;
        meta: boolean;
    }>({ ctrl: false, shift: false, alt: false, meta: false });

    // Track if any modifier was pressed during recording
    const hadModifierRef = useRef(false);

    // Toggle global class on body when recording state changes
    useEffect(() => {
        if (isRecording) {
            document.body.classList.add('ext-lw-recording-shortcut');
        } else {
            document.body.classList.remove('ext-lw-recording-shortcut');
        }

        return () => {
            document.body.classList.remove('ext-lw-recording-shortcut');
        };
    }, [isRecording]);

    useEffect(() => {
        if (!isRecording) {
            setPressedModifiers({ ctrl: false, shift: false, alt: false, meta: false });
            hadModifierRef.current = false;
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Update modifier state
            // Shift is RESERVED for multi-select in Smart Capture, so we block it here.
            // If user presses Shift, we ignore it as a modifier for the shortcut.
            const newModifiers = {
                ctrl: e.ctrlKey,
                shift: false, // Force Shift to false
                alt: e.altKey,
                meta: e.metaKey
            };

            // Check if any modifier (other than Shift) is pressed
            const hasModifier = e.ctrlKey || e.altKey || e.metaKey;

            if (hasModifier) {
                hadModifierRef.current = true;
            }

            // If it's a modifier key only, just update visual state
            if (MODIFIER_KEYS.includes(e.key)) {
                setPressedModifiers(newModifiers);
                return;
            }

            // Non-modifier key pressed
            // Must have at least one modifier to be valid
            if (!hasModifier) {
                // Invalid: no modifier key - cancel recording
                setIsRecording(false);
                return;
            }

            // Valid combination: modifier + key
            const newConfig: ShortcutConfig = {
                code: e.code,
                key: e.key,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey,
                isModifierOnly: false
            };

            onChange(newConfig);
            setIsRecording(false);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // If releasing a modifier key and no other keys were pressed after it
            if (MODIFIER_KEYS.includes(e.key) && hadModifierRef.current) {
                // Check which modifier was released
                let modifierCode = '';
                let modifierType: 'ctrl' | 'shift' | 'alt' | 'meta' | null = null;

                if (e.key === 'Control') {
                    modifierCode = e.code; // ControlLeft or ControlRight
                    modifierType = 'ctrl';
                } else if (e.key === 'Shift') {
                    modifierCode = e.code;
                    modifierType = 'shift';
                } else if (e.key === 'Alt') {
                    modifierCode = e.code;
                    modifierType = 'alt';
                } else if (e.key === 'Meta') {
                    modifierCode = e.code;
                    modifierType = 'meta';
                }

                // Only save if this was the only modifier pressed (single key hold)
                const currentMods = {
                    ctrl: pressedModifiers.ctrl,
                    shift: pressedModifiers.shift,
                    alt: pressedModifiers.alt,
                    meta: pressedModifiers.meta
                };

                // Count how many modifiers are currently pressed
                const modCount = [currentMods.ctrl, currentMods.shift, currentMods.alt, currentMods.meta].filter(Boolean).length;

                if (modCount === 1 && modifierType && currentMods[modifierType]) {
                    // Prevent Shift AND Control from being used as single-key hold shortcuts
                    if (modifierType === 'shift' || modifierType === 'ctrl') {
                        // Reset if user tries to set just Shift or Ctrl
                        const newModifiers = {
                            ctrl: false,
                            shift: false,
                            alt: e.key === 'Alt' ? false : pressedModifiers.alt,
                            meta: e.key === 'Meta' ? false : pressedModifiers.meta
                        };
                        setPressedModifiers(newModifiers);
                        setIsRecording(false);
                        return;
                    }

                    // Single modifier was held and released - save it
                    const newConfig: ShortcutConfig = {
                        code: modifierCode,
                        key: e.key, // Save the modifier key itself if needed
                        ctrlKey: false,
                        shiftKey: false,
                        altKey: modifierType === 'alt',
                        metaKey: modifierType === 'meta',
                        isModifierOnly: true
                    };

                    onChange(newConfig);
                    setIsRecording(false);
                    return;
                }
            }

            // Update pressed state on release
            // Shift is RESERVED, force to false
            const newModifiers = {
                ctrl: e.key === 'Control' ? false : pressedModifiers.ctrl,
                shift: false,
                alt: e.key === 'Alt' ? false : pressedModifiers.alt,
                meta: e.key === 'Meta' ? false : pressedModifiers.meta
            };
            setPressedModifiers(newModifiers);
        };

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
        };
    }, [isRecording, onChange, pressedModifiers]);

    // Render keys with Lucide icons
    const renderKey = (key: string, icon?: React.ReactNode) => (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-medium text-zinc-600 dark:text-zinc-400 mx-0.5 leading-none">
            {icon || key}
        </span>
    );

    const renderShortcutKeys = (cfg: ShortcutConfig) => {
        if (!cfg) return <span className="text-zinc-400 text-xs">Not set</span>;

        const elements = [];
        const iconSize = 12; // Standard icon size

        const ModCommand = <Command size={iconSize} />;
        const ModOption = <Option size={iconSize} />;
        const ModShift = <ArrowUp size={iconSize} />;
        const ModCtrl = <CaretUp size={iconSize} />;

        // Modifiers
        if (cfg.ctrlKey) elements.push(renderKey('', ModCtrl));
        if (cfg.altKey) elements.push(renderKey('', ModOption));
        if (cfg.shiftKey) elements.push(renderKey('', ModShift));
        if (cfg.metaKey) elements.push(renderKey('', ModCommand));

        if (cfg.isModifierOnly) return <div className="flex items-center">{elements}</div>;

        // Code formatting (fallback)
        let keyLabel = cfg.code.replace('Key', '').replace('Digit', '');

        // Use layout-aware key if available (fix for Turkish keyboard etc)
        if (cfg.key && cfg.key !== 'Unidentified' && cfg.key !== 'Dead') {
            if (cfg.key === ' ') keyLabel = 'Space';
            else if (cfg.key.length === 1) keyLabel = cfg.key.toLocaleUpperCase(i18n.language.startsWith('tr') ? 'tr' : 'en');
            else keyLabel = cfg.key;
        }

        let keyIcon = null;

        // Icon overrides
        if (keyLabel.startsWith('Arrow')) keyLabel = keyLabel.replace('Arrow', ''); // Up, Down, Left, Right

        if (keyLabel === 'Space') keyLabel = 'Space';
        if (keyLabel === 'Enter') keyIcon = <ArrowElbowDownLeft size={iconSize} />;
        if (keyLabel === 'Escape') keyLabel = 'Esc';
        if (keyLabel === 'Backspace') keyIcon = <Backspace size={iconSize} />;
        if (keyLabel === 'Tab') keyIcon = <ArrowRight size={iconSize} />;

        // Fix for common symbol keys having weird labels if code fallback was used
        // But if we used e.key, they should be symbols (e.g. '.', ',', 'Ş')

        elements.push(renderKey(keyLabel, keyIcon));

        return <div className="flex items-center">{elements}</div>;
    };

    const getPrefix = () => {
        return config.isModifierOnly ? t('shortcut.holdKey') : t('shortcut.pressKey');
    };

    if (isRecording) {
        // Show currently pressed modifiers with icons
        const iconSize = 12;
        const elements = [];

        if (pressedModifiers.ctrl) elements.push(renderKey('', <CaretUp size={iconSize} />));
        if (pressedModifiers.alt) elements.push(renderKey('', <Option size={iconSize} />));
        if (pressedModifiers.shift) elements.push(renderKey('', <ArrowUp size={iconSize} />));
        if (pressedModifiers.meta) elements.push(renderKey('', <Command size={iconSize} />));

        const content = elements.length > 0 ? (
            <div className="flex items-center gap-0.5">{elements} <span className="ml-1 text-[10px] text-blue-500">...</span></div>
        ) : (
            <span className="text-[10px] text-blue-500">Type keys...</span>
        );

        return (
            <div className="flex items-center gap-2">
                <div
                    className="h-6 px-2 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center min-w-[60px] cursor-pointer"
                    onClick={() => setIsRecording(false)}
                    title="Click to cancel"
                >
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsRecording(true)}>
            {/* Morphing Label: Text <-> Icon */}
            <div className="relative w-[34px] h-4 flex items-center justify-end overflow-hidden">
                {/* Default: Text */}
                <span className="absolute right-0 text-[10px] text-zinc-400 font-medium transition-all duration-200 group-hover:translate-y-[-150%] group-hover:opacity-0 select-none">
                    {getPrefix()}
                </span>

                {/* Hover: Pencil Icon */}
                <span className="absolute right-0 text-zinc-400 group-hover:text-blue-500 transition-all duration-200 translate-y-[150%] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 flex items-center justify-center">
                    <PencilSimple size={12} />
                </span>
            </div>

            {/* Keys remaining stationary */}
            {renderShortcutKeys(config)}
        </div>
    );
};
