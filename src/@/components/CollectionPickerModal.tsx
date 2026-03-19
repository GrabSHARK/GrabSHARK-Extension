import { FC, useState, useEffect } from 'react';
import { X, MagnifyingGlass, Folder, Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface Collection {
    id: number;
    name: string;
    color?: string;
    parentId?: number | null;
}

interface CollectionPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (collection: Collection) => void;
    selectedCollectionId?: number | null;
}

export const CollectionPickerModal: FC<CollectionPickerModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    selectedCollectionId
}) => {
    const { t } = useTranslation();
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsClosing(false);
            setLoading(true);
            chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' }, (response) => {

                if (response?.success && response.data) {
                    // Handle both array format and { response: [...] } format
                    const collections = Array.isArray(response.data)
                        ? response.data
                        : (response.data.response || []);
                    setCollections(collections);
                }
                setLoading(false);
            });
        }
    }, [isOpen]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 150);
    };

    const filteredCollections = collections.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen && !isVisible) return null;

    return (
        <div className={cn(
            "absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-150",
            isClosing ? "opacity-0" : "opacity-100"
        )}>
            {/* Blur backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className={cn(
                "relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[70vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800 transition-all duration-150",
                isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {t('preferences.selectCollection')}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="relative">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder={t('preferences.searchCollections')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                        />
                    </div>
                </div>

                {/* Collection List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredCollections.length === 0 ? (
                        <div className="text-center py-8 text-sm text-zinc-500">
                            {t('preferences.noCollectionsFound')}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredCollections.map((collection) => (
                                <button
                                    key={collection.id}
                                    onClick={() => onSelect(collection)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                                        selectedCollectionId === collection.id
                                            ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                    )}
                                >
                                    <Folder
                                        className="w-5 h-5 flex-shrink-0"
                                        weight={selectedCollectionId === collection.id ? "fill" : "regular"}
                                        style={{ color: collection.color || undefined }}
                                    />
                                    <span className="flex-1 text-sm truncate">{collection.name}</span>
                                    {selectedCollectionId === collection.id && (
                                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
