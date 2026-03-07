/**
 * BookmarkCollectionPicker - Collection picker sub-component for BookmarkForm
 * Extracts the Popover/Command collection selection UI (~115L of JSX)
 */

import { Check } from '@phosphor-icons/react';
import { CaretSortIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/Form';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { Button } from '../ui/Button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../ui/Command';

interface BookmarkCollectionPickerProps {
    control: any;
    form: any;
    collections: any[] | undefined;
    loadingCollections: boolean;
    isLoading: boolean;
    openCollections: boolean;
    setOpenCollections: (v: boolean) => void;
}

export const BookmarkCollectionPicker = ({
    control, form, collections, loadingCollections, isLoading, openCollections, setOpenCollections,
}: BookmarkCollectionPickerProps) => {
    const { t } = useTranslation();

    return (
        <FormField
            control={control}
            name="collection"
            render={({ field }) => (
                <FormItem className="my-2">
                    <FormLabel>{t('bookmark.collection')}</FormLabel>
                    <div className="min-w-full inset-x-0">
                        <Popover open={openCollections} onOpenChange={setOpenCollections}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant="outline" role="combobox" aria-expanded={openCollections} className="w-full justify-between bg-neutral-100 dark:bg-neutral-900">
                                        {loadingCollections ? t('bookmark.gettingCollections')
                                            : field.value?.name
                                                ? collections?.find((c: { name: string }) => c.name === field.value?.name)?.name || form.getValues('collection')?.name
                                                : t('bookmark.selectCollection')}
                                        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder={t('bookmark.searchCollection')} />
                                    <CommandEmpty>{t('bookmark.noCollectionFound')}</CommandEmpty>
                                    <CommandGroup className="max-h-[200px] overflow-auto">
                                        {isLoading ? (
                                            <CommandItem value={t('bookmark.gettingCollections')} onSelect={() => { form.setValue('collection', { name: t('bookmark.unorganized') }); setOpenCollections(false); }}>
                                                {t('bookmark.unorganized')}
                                            </CommandItem>
                                        ) : (<>
                                            <CommandItem value={t('bookmark.unorganized')} onSelect={() => { form.setValue('collection', { name: t('bookmark.unorganized') }); setOpenCollections(false); }}>
                                                <Check className={`mr-2 h-4 w-4 ${field.value?.name === t('bookmark.unorganized') ? 'opacity-100' : 'opacity-0'}`} />
                                                {t('bookmark.unorganized')}
                                            </CommandItem>
                                            {collections?.map((collection: { name: string; id: number; ownerId: number; pathname: string }) => (
                                                <CommandItem value={collection.name} key={collection.id} className="cursor-pointer"
                                                    onSelect={() => { form.setValue('collection', { ownerId: collection.ownerId, id: collection.id, name: collection.name }); setOpenCollections(false); }}>
                                                    <Check className={`mr-2 h-4 w-4 ${field.value?.name === collection.name ? 'opacity-100' : 'opacity-0'}`} />
                                                    <div className="flex flex-col">
                                                        <span>{collection.name}</span>
                                                        {collection.pathname && <span className="text-xs text-muted-foreground opacity-70">{collection.pathname}</span>}
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </>)}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
};
