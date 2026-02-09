import { FC } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FolderSimple, CaretDown } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Form, FormControl, FormField, FormItem } from '../ui/Form';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { Command, CommandGroup, CommandItem } from '../ui/Command';
import { Textarea } from '../ui/Textarea';
import { TagInput } from '../TagInput';
import { OutlineSparkleIcon } from '../CustomIcons';
import Icon from '../Icon';
import { cn } from '../../lib/utils';

// Chevron icons locally if not imported
const ChevronCompactDown = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M1.553 6.776a.5.5 0 0 1 .67-.223L8 9.44l5.776-2.888a.5.5 0 1 1 .448.894l-6 3a.5.5 0 0 1-.448 0l-6-3a.5.5 0 0 1-.223-.67z" />
    </svg>
);

const ChevronCompactUp = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={className} viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M7.776 5.553a.5.5 0 0 1 .448 0l6 3a.5.5 0 1 1-.448.894L8 6.56 2.224 9.447a.5.5 0 1 1-.448-.894l6-3z" />
    </svg>
);

interface SaveLinkFormProps {
    form: UseFormReturn<any>;
    formSubmit: (e: any) => void;
    collections: any[];
    loadingCollections: boolean;
    openCollections: boolean;
    setOpenCollections: (open: boolean) => void;
    tags: any[];
    loadingTags: boolean;
    openTags: boolean;
    setOpenTags: (open: boolean) => void;
    isDetailed: boolean;
    setIsDetailed: (val: boolean) => void;
    userProfile: any;
    isSuggestingTags: boolean;
    handleSuggestTags: () => void;
    manualTaggingRef: React.MutableRefObject<boolean>;
    setArchiveOptions: (options: any) => void;
    containerRef?: HTMLElement | null;
}

export const SaveLinkForm: FC<SaveLinkFormProps> = ({
    form,
    formSubmit,
    collections,
    loadingCollections,
    openCollections,
    setOpenCollections,
    tags,
    loadingTags,
    openTags,
    setOpenTags,
    isDetailed,
    setIsDetailed,
    userProfile,
    isSuggestingTags,
    handleSuggestTags,
    manualTaggingRef,
    setArchiveOptions,
    containerRef
}) => {
    const { t } = useTranslation();

    return (
        <>
            {/* Actions Separator WITH Collection Selector Inserted */}
            <div className="px-4 pt-0 pb-2">
                <Form {...form}>
                    <form onSubmit={formSubmit} className="space-y-3">
                        <FormField
                            control={form.control}
                            name="collection"
                            render={({ field }) => {
                                // Lookup full collection object to ensure we have icon/color data
                                const selectedCollection = collections?.find((c: any) => c.id == field.value?.id) ||
                                    collections?.find((c: any) => c.name === field.value?.name) ||
                                    field.value;

                                return (
                                    <FormItem>
                                        <Popover open={openCollections} onOpenChange={(val) => {
                                            setOpenCollections(val);
                                            if (val) setOpenTags(false);
                                        }}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <button
                                                        type="button"
                                                        role="combobox"
                                                        aria-expanded={openCollections}
                                                        className={cn(
                                                            "w-full flex items-center justify-between bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 font-normal rounded-xl h-10 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                        disabled={loadingCollections}
                                                    >
                                                        <div className="flex items-center gap-2 truncate text-zinc-800 dark:text-zinc-200">
                                                            {/* @ts-ignore */}
                                                            {selectedCollection?.icon ? (
                                                                /* @ts-ignore */
                                                                <Icon icon={selectedCollection.icon} className="w-4 h-4 shrink-0" color={selectedCollection.color ?? undefined} />
                                                            ) : (selectedCollection as any)?.color ? (
                                                                /* @ts-ignore */
                                                                <FolderSimple className="w-4 h-4 shrink-0" weight="fill" style={{ color: selectedCollection.color }} />
                                                            ) : (
                                                                <FolderSimple className="w-4 h-4 shrink-0 text-zinc-400" weight="fill" />
                                                            )}
                                                            <span>{selectedCollection?.name || t('bookmark.unorganized')}</span>
                                                        </div>
                                                        <CaretDown className={cn("ml-2 h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200", openCollections && "rotate-180")} />
                                                    </button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#1a1a1c] shadow-lg" align="start" portal={true} container={containerRef} sideOffset={2}>
                                                <Command className="bg-transparent" shouldFilter={false}>
                                                    <CommandGroup className="max-h-[200px] overflow-y-auto overscroll-contain p-1">
                                                        {collections?.map((c: any) => (
                                                            <CommandItem
                                                                key={c.id}
                                                                value={c.name}
                                                                onSelect={() => {
                                                                    form.setValue('collection', c);
                                                                    setOpenCollections(false);
                                                                }}
                                                                className="data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900 dark:data-[selected=true]:bg-zinc-800 dark:data-[selected=true]:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 my-0.5 rounded-xl mx-0.5 cursor-pointer px-2 py-1.5 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2 w-full">
                                                                    {c.icon ? (
                                                                        <Icon icon={c.icon} className="w-4 h-4 shrink-0" color={c.color} />
                                                                    ) : c.color ? (
                                                                        <FolderSimple className="w-4 h-4 shrink-0" weight="fill" style={{ color: c.color }} />
                                                                    ) : (
                                                                        <FolderSimple className="w-4 h-4 shrink-0 text-zinc-400" weight="fill" />
                                                                    )}
                                                                    <span className="truncate text-sm">{c.name}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )
                            }}
                        />

                        {/* Collapsible Details Section (Drawer) */}
                        <div className={cn(
                            "grid transition-all duration-300 ease-in-out",
                            isDetailed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        )}>
                            <div className="overflow-hidden space-y-3">
                                {/* Tags with AI Suggest Button */}
                                <FormField
                                    control={form.control}
                                    name="tags"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="relative flex items-center">
                                                    {/* AI Suggest Tags Button - positioned inside input as left prefix */}
                                                    {userProfile?.aiTaggingMethod && userProfile.aiTaggingMethod !== 'DISABLED' && (
                                                        <button
                                                            type="button"
                                                            onClick={handleSuggestTags}
                                                            disabled={isSuggestingTags || loadingTags}
                                                            className={cn(
                                                                "absolute left-2 z-10 w-5 h-5 flex items-center justify-center transition-all duration-200",
                                                                isSuggestingTags
                                                                    ? "text-blue-500"
                                                                    : "text-zinc-400 hover:text-blue-500"
                                                            )}
                                                            title="Generate AI tag suggestions"
                                                        >
                                                            <OutlineSparkleIcon className="w-4 h-4" loading={isSuggestingTags} />
                                                        </button>
                                                    )}
                                                    {loadingTags ? (
                                                        <div className="p-2 text-xs text-zinc-500 flex-1">{t('editLink.loadingTags')}</div>
                                                    ) : (
                                                        <div className="flex-1">
                                                            <TagInput
                                                                tags={tags || []}
                                                                value={field.value || []}
                                                                onChange={(val) => {
                                                                    field.onChange(val);
                                                                    manualTaggingRef.current = true;
                                                                    // Auto-disable AI tagging if user manually edits tags
                                                                    // Force disable without checking current state to avoid stale closures
                                                                    setArchiveOptions((prev: any) => prev ? { ...prev, aiTag: false } : null);
                                                                }}
                                                                className={cn(
                                                                    "bg-white dark:bg-[#1a1a1c] border-zinc-200 dark:border-zinc-800/50 w-full",
                                                                    userProfile?.aiTaggingMethod && userProfile.aiTaggingMethod !== 'DISABLED' && "pl-8"
                                                                )}
                                                                open={openTags}
                                                                onOpenChange={(val) => {
                                                                    setOpenTags(val);
                                                                    if (val) setOpenCollections(false);
                                                                }}
                                                                containerRef={containerRef}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* Note / Description */}
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={t('editLink.descriptionPlaceholder') || "Description"}
                                                    className="resize-none bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 focus-visible:ring-0 focus-visible:border-zinc-300 dark:focus-visible:border-zinc-700 min-h-[70px] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                    </form>
                </Form>
            </div>

            {/* Drawer Toggle */}
            <div className="flex justify-center -mt-2 pb-1 relative z-10">
                <button
                    type="button"
                    onClick={() => setIsDetailed(!isDetailed)}
                    className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors p-1"
                >
                    {isDetailed ? (
                        <ChevronCompactUp className="w-5 h-5" />
                    ) : (
                        <ChevronCompactDown className="w-5 h-5" />
                    )}
                </button>
            </div>
        </>
    );
};
