import { FC } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FolderSimple, CaretDown } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Form, FormControl, FormField, FormItem } from '../ui/Form';
import { Popover, PopoverContent, PopoverAnchor } from '../ui/Popover';
import { Command, CommandGroup, CommandItem } from '../ui/Command';
import { Textarea } from '../ui/Textarea';
import { TagInput } from '../TagInput';
import { OutlineSparkleIcon } from '../CustomIcons';
import Icon from '../Icon';
import { cn } from '../../lib/utils';

interface EditLinkFormProps {
    form: UseFormReturn<any>;
    handleSave: (data: any) => void;
    collections: any[];
    loadingCollections: boolean;
    openCollections: boolean;
    setOpenCollections: (open: boolean) => void;
    handleToggleCollections: (e: React.MouseEvent) => void;
    tags: any[];
    loadingTags: boolean;
    openTags: boolean;
    setOpenTags: (open: boolean) => void;
    userProfile: any;
    isSuggestingTags: boolean;
    handleSuggestTags: () => void;
    containerRef: HTMLElement | null;
}

export const EditLinkForm: FC<EditLinkFormProps> = ({
    form,
    handleSave,
    collections,
    loadingCollections,
    openCollections,
    setOpenCollections,
    handleToggleCollections,
    tags,
    loadingTags,
    openTags,
    setOpenTags,
    userProfile,
    isSuggestingTags,
    handleSuggestTags,
    containerRef
}) => {
    const { t } = useTranslation();

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => handleSave(d))} className="space-y-3">
                {/* Collection */}
                <FormField
                    control={form.control}
                    name="collection"
                    render={({ field }) => (
                        <FormItem>
                            <Popover open={openCollections} onOpenChange={setOpenCollections}>
                                <PopoverAnchor asChild>
                                    <FormControl>
                                        <button
                                            type="button"
                                            role="combobox"
                                            aria-expanded={openCollections}
                                            onPointerDown={handleToggleCollections}
                                            className={cn(
                                                "w-full flex items-center justify-between bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 font-normal rounded-xl h-11 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            disabled={loadingCollections}
                                        >
                                            <div className="flex items-center gap-2 truncate text-zinc-800 dark:text-zinc-200">
                                                {field.value?.icon ? (
                                                    <Icon icon={field.value.icon} className="w-4 h-4 shrink-0" color={field.value.color ?? undefined} />
                                                ) : field.value?.color ? (
                                                    <FolderSimple className="w-4 h-4 shrink-0" weight="fill" style={{ color: field.value.color }} />
                                                ) : (
                                                    <FolderSimple className="w-4 h-4 shrink-0 text-zinc-400" weight="fill" />
                                                )}
                                                <span>{field.value?.name || t('editLink.unorganized')}</span>
                                            </div>
                                            <CaretDown className={cn("ml-2 h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200", openCollections && "rotate-180")} />
                                        </button>
                                    </FormControl>
                                </PopoverAnchor>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#1a1a1c] shadow-lg" align="start" portal={true} container={containerRef} sideOffset={2}>
                                    <Command className="bg-transparent" shouldFilter={false}>
                                        <CommandGroup className="max-h-[200px] overflow-y-auto overscroll-contain p-1">
                                            {collections?.map((c: any) => (
                                                <CommandItem
                                                    key={c.id}
                                                    value={c.name}
                                                    onSelect={() => {
                                                        form.setValue('collection', c, { shouldDirty: true });
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
                                                        <span className="truncate">{c.name}</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </FormItem>
                    )}
                />

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
                                                // Ensure value is always an array
                                                value={field.value || []}
                                                onChange={field.onChange}
                                                className={cn(
                                                    "bg-white dark:bg-[#1a1a1c] border-zinc-200 dark:border-zinc-800/50",
                                                    userProfile?.aiTaggingMethod && userProfile.aiTaggingMethod !== 'DISABLED' && "pl-8"
                                                )}
                                                containerRef={containerRef}
                                                open={openTags}
                                                onOpenChange={(val) => {
                                                    setOpenTags(val);
                                                    if (val) setOpenCollections(false);
                                                }}
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
                                    placeholder={t('editLink.descriptionPlaceholder')}
                                    className="resize-none bg-white dark:bg-[#1a1a1c] border-zinc-200 dark:border-zinc-800/50 focus-visible:ring-0 focus-visible:border-zinc-200 dark:focus-visible:border-zinc-800/50 min-h-[70px] rounded-xl text-sm placeholder:text-zinc-500 dark:placeholder:text-zinc-600 text-zinc-900 dark:text-zinc-100"
                                    {...field}
                                    value={field.value || ''}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </form>
        </Form>
    );
};
