import { useForm } from 'react-hook-form';
import {
  bookmarkFormSchema,
  bookmarkFormValues,
} from '../lib/validators/bookmarkForm.ts';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/Form.tsx';
import { Input } from './ui/Input.tsx';
import { Button } from './ui/Button.tsx';
import { TagInput } from './TagInput.tsx';
import { Textarea } from './ui/Textarea.tsx';
import { cn, checkDuplicatedItem, getCurrentTabInfo } from '../lib/utils.ts';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getConfig, isConfigured } from '../lib/config.ts';
import { postLink } from '../lib/actions/links.ts';
import { AxiosError } from 'axios';
import { toast } from '../../hooks/use-toast.ts';
import { Toaster } from './ui/Toaster.tsx';
import { getCollections, ResponseCollections } from '../lib/actions/collections.ts';
import { getTags, ResponseTags } from '../lib/actions/tags.ts';
import { Check } from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover.tsx';
import { CaretSortIcon } from '@radix-ui/react-icons';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './ui/Command.tsx';
import { saveLinksInCache } from '../lib/cache.ts';
import { Checkbox } from './ui/CheckBox.tsx';
import { Label } from './ui/Label.tsx';
import { useTranslation } from 'react-i18next';

let configured = false;

const BookmarkForm = ({ onClose, onSuccess }: { onClose?: () => void; onSuccess?: (link: any) => void }) => {
  const { t } = useTranslation();
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false);
  const [openOptions, setOpenOptions] = useState<boolean>(false);
  const [openCollections, setOpenCollections] = useState<boolean>(false);
  const [uploadImage, setUploadImage] = useState<boolean>(false);
  const [state, setState] = useState<'capturing' | 'uploading' | null>(null);

  const handleCheckedChange = (s: boolean | 'indeterminate') => {
    if (s === 'indeterminate') return;
    setUploadImage(s);
    form.setValue('image', s ? 'png' : undefined);
  };

  const form = useForm<bookmarkFormValues>({
    resolver: zodResolver(bookmarkFormSchema),
    defaultValues: {
      url: '',
      name: '',
      collection: {
        name: t('bookmark.unorganized'),
      },
      tags: [],
      description: '',
      image: undefined,
    },
  });

  const { mutate: onSubmit, isLoading } = useMutation({
    mutationFn: async (values: bookmarkFormValues) => {
      const config = await getConfig();

      const result = await postLink(
        config.baseUrl,
        uploadImage,
        values,
        setState,
        config.apiKey
      );

      return result?.data?.response;
    },
    onError: (error) => {

      if (error instanceof AxiosError) {
        if (error.response?.status === 409) {
          toast({
            title: t('bookmark.alreadySavedTitle'),
            description: t('bookmark.alreadySavedDesc'),
          });
          setIsDuplicate(true);
          // If duplicate, ideally we should fetch the link and show the AlreadySavedView
          // But currently we just show text. 
          // The parent EmbeddedApp handles the initial check. 
          // If we hit this, it means we missed the initial check or it was added concurrently.
          return;
        }

        toast({
          title: t('bookmark.errorTitle'),
          description:
            error.response?.data.response ||
            t('bookmark.errorGeneric'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('bookmark.errorTitle'),
          description:
            (error as Error).message ||
            t('bookmark.errorGeneric'),
          variant: 'destructive',
        });
      }
      return;
    },
    onSuccess: (data) => {
      toast({
        title: t('bookmark.successTitle'),
        description: t('bookmark.successDesc'),
      });

      if (onSuccess && data) {
        onSuccess(data);
      } else {
        setIsDuplicate(true);
        setTimeout(() => {
          if (onClose) onClose();
          else window.close();
        }, 1500);
      }
    },
  });

  const { handleSubmit, control } = form;

  useEffect(() => {
    const init = async () => {
      // Parallelize initialization
      const tabInfoPromise = getCurrentTabInfo();
      const configPromise = getConfig();
      const configuredPromise = isConfigured();
      const duplicateCheckPromise = checkDuplicatedItem();

      const [tabInfo, config, isConf, isDup] = await Promise.all([
        tabInfoPromise,
        configPromise,
        configuredPromise,
        duplicateCheckPromise
      ]);

      form.setValue('url', tabInfo.url ? tabInfo.url : '');
      form.setValue('name', tabInfo.title ? tabInfo.title : '');
      form.setValue('collection', {
        name: config.defaultCollection,
      });

      configured = isConf;
      setIsDuplicate(isDup);
    };

    init();
  }, [form]);

  useEffect(() => {
    const syncBookmarks = async () => {
      try {
        const { syncBookmarks, baseUrl, defaultCollection } = await getConfig();
        form.setValue('collection', {
          name: defaultCollection,
        });
        if (!syncBookmarks) {
          return;
        }
        if (await isConfigured()) {
          await saveLinksInCache(baseUrl);
          //await syncLocalBookmarks(baseUrl);
        }
      } catch (error) {

      }
    };
    syncBookmarks();
  }, [form]);

  const {
    isLoading: loadingCollections,
    data: collections,
    error: collectionError,
  } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const config = await getConfig();

      const response = await getCollections(config.baseUrl, config.apiKey);

      return response.data.response.sort((a: ResponseCollections, b: ResponseCollections) => {
        return (a.pathname || '').localeCompare(b.pathname || '');
      });
    },
    enabled: configured,
  });

  const {
    isLoading: loadingTags,
    data: tags,
    error: tagsError,
  } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const config = await getConfig();

      const response = await getTags(config.baseUrl, config.apiKey);

      return response.data.response.sort((a: ResponseTags, b: ResponseTags) => {
        return a.name.localeCompare(b.name);
      });
    },
    enabled: configured,
  });

  return (
    <div>
      <Form {...form}>
        <form onSubmit={handleSubmit((e) => onSubmit(e))} className="py-1">
          {collectionError ? (
            <p className="text-red-600">
              {t('bookmark.errorGeneric')}
            </p>
          ) : null}
          <FormField
            control={control}
            name="collection"
            render={({ field }) => (
              <FormItem className={`my-2`}>
                <FormLabel>{t('bookmark.collection')}</FormLabel>
                <div className="min-w-full inset-x-0">
                  <Popover
                    open={openCollections}
                    onOpenChange={setOpenCollections}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCollections}
                          className={
                            'w-full justify-between bg-neutral-100 dark:bg-neutral-900'
                          }
                        >
                          {loadingCollections
                            ? t('bookmark.gettingCollections')
                            : field.value?.name
                              ? collections?.find(
                                (collection: { name: string }) =>
                                  collection.name === field.value?.name
                              )?.name || form.getValues('collection')?.name
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
                            <CommandItem
                              value={t('bookmark.gettingCollections')}
                              onSelect={() => {
                                form.setValue('collection', {
                                  name: t('bookmark.unorganized'),
                                });
                                setOpenCollections(false);
                              }}
                            >
                              {t('bookmark.unorganized')}
                            </CommandItem>
                          ) : (
                            <>
                              <CommandItem
                                value={t('bookmark.unorganized')}
                                onSelect={() => {
                                  form.setValue('collection', {
                                    name: t('bookmark.unorganized'),
                                  });
                                  setOpenCollections(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${field.value?.name === 'Unorganized'
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                    }`}
                                />
                                {t('bookmark.unorganized')}
                              </CommandItem>
                              {collections?.map(
                                (collection: {
                                  name: string;
                                  id: number;
                                  ownerId: number;
                                  pathname: string;
                                }) => (
                                  <CommandItem
                                    value={collection.name}
                                    key={collection.id}
                                    className="cursor-pointer"
                                    onSelect={() => {
                                      form.setValue('collection', {
                                        ownerId: collection.ownerId,
                                        id: collection.id,
                                        name: collection.name,
                                      });
                                      setOpenCollections(false);
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${field.value?.name === collection.name
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                        }`}
                                    />
                                    <div className="flex flex-col">
                                      <span>{collection.name}</span>
                                      {collection.pathname && (
                                        <span className="text-xs text-muted-foreground opacity-70">
                                          {collection.pathname}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                )
                              )}
                            </>
                          )}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {openOptions && (
            <div className="details list-none space-y-5 pt-2">
              {tagsError ? <p>{t('bookmark.errorGeneric')}</p> : null}
              <FormField
                control={control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookmark.tags')}</FormLabel>
                    {loadingTags ? (
                      <TagInput
                        onChange={field.onChange}
                        value={[{ name: t('bookmark.gettingTags') }]}
                        tags={[{ id: 1, name: t('bookmark.gettingTags') }]}
                      />
                    ) : tagsError ? (
                      <TagInput
                        onChange={field.onChange}
                        value={[{ name: t('bookmark.notFound') }]}
                        tags={[{ id: 1, name: t('bookmark.notFound') }]}
                      />
                    ) : (
                      <TagInput
                        onChange={field.onChange}
                        value={field.value ?? []}
                        tags={tags}
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookmark.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Google..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookmark.description')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('bookmark.description') + "..."} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Label className="flex items-center gap-2 w-fit cursor-pointer">
                <Checkbox
                  checked={uploadImage}
                  onCheckedChange={handleCheckedChange}
                />
                {t('bookmark.uploadImage')}
              </Label>
            </div>
          )}
          {isDuplicate && (
            <p className="text-muted text-zinc-600 dark:text-zinc-400 mt-2">
              {t('bookmark.alreadySavedDesc')}
            </p>
          )}
          <div className="flex justify-between items-center mt-4">
            <div
              className="inline-flex select-none items-center justify-center rounded-md text-sm font-medium ring-offset-background
               transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
               focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
               hover:bg-accent hover:text-accent-foreground hover:cursor-pointer p-2"
              onClick={() => setOpenOptions((prevState) => !prevState)}
            >
              {openOptions ? t('bookmark.hide') : t('bookmark.more')} {t('bookmark.options')}
            </div>
            <Button
              disabled={isLoading || isDuplicate}
              type="submit"
              className={cn(
                "w-full h-9 rounded-lg font-medium text-sm mt-1 transition-all duration-300",
                isDuplicate
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 shadow-none pointer-events-none"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_rgba(37,99,235,0.45)]"
              )}
            >
              {isDuplicate ? t('bookmark.saved') : t('bookmark.save')}
            </Button>
          </div>
        </form>
      </Form>
      <Toaster />
      {state && (
        <div className="fixed inset-0 bg-black backdrop-blur-md bg-opacity-50 flex items-center justify-center">
          <div className="text-white p-4 rounded-md flex flex-col items-center w-fit">
            <svg
              className="animate-spin h-10 w-10"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>

            <p className="text-xl mt-1">
              {state === 'capturing'
                ? t('bookmark.capturing')
                : t('bookmark.uploading')}
            </p>
            <p className="text-xs text-center max-w-xs">
              {t('bookmark.waitMessage')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookmarkForm;
