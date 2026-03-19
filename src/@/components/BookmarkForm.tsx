import { useForm } from 'react-hook-form';
import { bookmarkFormSchema, bookmarkFormValues } from '../lib/validators/bookmarkForm.ts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from './ui/Form.tsx';
import { Button } from './ui/Button.tsx';
import { Toaster } from './ui/Toaster.tsx';
import { cn, checkDuplicatedItem, getCurrentTabInfo } from '../lib/utils.ts';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getConfig, isConfigured } from '../lib/config.ts';
import { postLink } from '../lib/actions/links.ts';
import { AxiosError } from 'axios';
import { toast } from '../../hooks/use-toast.ts';
import { getCollections, ResponseCollections } from '../lib/actions/collections.ts';
import { getTags, ResponseTags } from '../lib/actions/tags.ts';
import { saveLinksInCache } from '../lib/cache.ts';
import { useTranslation } from 'react-i18next';
import { BookmarkCollectionPicker } from './Bookmark/BookmarkCollectionPicker.tsx';
import { BookmarkOptions } from './Bookmark/BookmarkOptions.tsx';

let configured = false;

const BookmarkForm = ({ onClose, onSuccess }: { onClose?: () => void; onSuccess?: (link: any) => void }) => {
  const { t } = useTranslation();
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false);
  const [openOptions, setOpenOptions] = useState<boolean>(false);
  const [openCollections, setOpenCollections] = useState<boolean>(false);
  const [uploadImage, setUploadImage] = useState<boolean>(false);
  const [state, setState] = useState<'capturing' | 'uploading' | null>(null);

  const handleCheckedChange = (s: boolean | 'indeterminate') => { if (s !== 'indeterminate') { setUploadImage(s); form.setValue('image', s ? 'png' : undefined); } };

  const form = useForm<bookmarkFormValues>({
    resolver: zodResolver(bookmarkFormSchema),
    defaultValues: { url: '', name: '', collection: { name: t('bookmark.unorganized') }, tags: [], description: '', image: undefined },
  });

  const { mutate: onSubmit, isLoading } = useMutation({
    mutationFn: async (values: bookmarkFormValues) => {
      const config = await getConfig();
      const result = await postLink(config.baseUrl, uploadImage, values, setState, config.apiKey);
      return result?.data?.response;
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        if (error.response?.status === 409) { toast({ title: t('bookmark.alreadySavedTitle'), description: t('bookmark.alreadySavedDesc') }); setIsDuplicate(true); return; }
        toast({ title: t('bookmark.errorTitle'), description: error.response?.data.response || t('bookmark.errorGeneric'), variant: 'destructive' });
      } else { toast({ title: t('bookmark.errorTitle'), description: (error as Error).message || t('bookmark.errorGeneric'), variant: 'destructive' }); }
    },
    onSuccess: (data) => {
      toast({ title: t('bookmark.successTitle'), description: t('bookmark.successDesc') });
      if (onSuccess && data) onSuccess(data);
      else { setIsDuplicate(true); setTimeout(() => { if (onClose) onClose(); else window.close(); }, 1500); }
    },
  });

  const { handleSubmit, control } = form;

  useEffect(() => {
    (async () => {
      const [tabInfo, config, isConf, isDup] = await Promise.all([getCurrentTabInfo(), getConfig(), isConfigured(), checkDuplicatedItem()]);
      form.setValue('url', tabInfo.url || '');
      form.setValue('name', tabInfo.title || '');
      form.setValue('collection', { name: config.defaultCollection });
      configured = isConf;
      setIsDuplicate(isDup);
    })();
  }, [form]);

  useEffect(() => {
    (async () => {
      try {
        const { syncBookmarks, baseUrl, defaultCollection } = await getConfig();
        form.setValue('collection', { name: defaultCollection });
        if (syncBookmarks && await isConfigured()) await saveLinksInCache(baseUrl);
      } catch { }
    })();
  }, [form]);

  const { isLoading: loadingCollections, data: collections, error: collectionError } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => { const c = await getConfig(); const r = await getCollections(c.baseUrl, c.apiKey); return r.data.response.sort((a: ResponseCollections, b: ResponseCollections) => (a.pathname || '').localeCompare(b.pathname || '')); },
    enabled: configured,
  });

  const { isLoading: loadingTags, data: tags, error: tagsError } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => { const c = await getConfig(); const r = await getTags(c.baseUrl, c.apiKey); return r.data.response.sort((a: ResponseTags, b: ResponseTags) => a.name.localeCompare(b.name)); },
    enabled: configured,
  });

  return (
    <div>
      <Form {...form}>
        <form onSubmit={handleSubmit((e) => onSubmit(e))} className="py-1">
          {collectionError ? <p className="text-red-600">{t('bookmark.errorGeneric')}</p> : null}
          <BookmarkCollectionPicker control={control} form={form} collections={collections} loadingCollections={loadingCollections} isLoading={isLoading} openCollections={openCollections} setOpenCollections={setOpenCollections} />
          {openOptions && <BookmarkOptions control={control} tags={tags} loadingTags={loadingTags} tagsError={tagsError} uploadImage={uploadImage} onCheckedChange={handleCheckedChange} />}
          {isDuplicate && <p className="text-muted text-zinc-600 dark:text-zinc-400 mt-2">{t('bookmark.alreadySavedDesc')}</p>}
          <div className="flex justify-between items-center mt-4">
            <div className="inline-flex select-none items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground hover:cursor-pointer p-2"
              onClick={() => setOpenOptions(prev => !prev)}>
              {openOptions ? t('bookmark.hide') : t('bookmark.more')} {t('bookmark.options')}
            </div>
            <Button disabled={isLoading || isDuplicate} type="submit"
              className={cn("w-full h-9 rounded-lg font-medium text-sm mt-1 transition-all duration-300",
                isDuplicate ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 shadow-none pointer-events-none"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_rgba(37,99,235,0.45)]")}>
              {isDuplicate ? t('bookmark.saved') : t('bookmark.save')}
            </Button>
          </div>
        </form>
      </Form>
      <Toaster />
      {state && (
        <div className="fixed inset-0 bg-black backdrop-blur-md bg-opacity-50 flex items-center justify-center">
          <div className="text-white p-4 rounded-md flex flex-col items-center w-fit">
            <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xl mt-1">{state === 'capturing' ? t('bookmark.capturing') : t('bookmark.uploading')}</p>
            <p className="text-xs text-center max-w-xs">{t('bookmark.waitMessage')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookmarkForm;
