/**
 * BookmarkOptions - Options section sub-component for BookmarkForm
 * Extracts tags, name, description fields and upload checkbox (~65L of JSX)
 */

import { useTranslation } from 'react-i18next';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/Form';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { TagInput } from '../TagInput';
import { Checkbox } from '../ui/CheckBox';
import { Label } from '../ui/Label';

interface BookmarkOptionsProps {
    control: any;
    tags: any[] | undefined;
    loadingTags: boolean;
    tagsError: any;
    uploadImage: boolean;
    onCheckedChange: (s: boolean | 'indeterminate') => void;
}

export const BookmarkOptions = ({ control, tags, loadingTags, tagsError, uploadImage, onCheckedChange }: BookmarkOptionsProps) => {
    const { t } = useTranslation();

    return (
        <div className="details list-none space-y-5 pt-2">
            {tagsError ? <p>{t('bookmark.errorGeneric')}</p> : null}
            <FormField control={control} name="tags"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('bookmark.tags')}</FormLabel>
                        {loadingTags ? <TagInput onChange={field.onChange} value={[{ name: t('bookmark.gettingTags') }]} tags={[{ id: 1, name: t('bookmark.gettingTags') }]} />
                            : tagsError ? <TagInput onChange={field.onChange} value={[{ name: t('bookmark.notFound') }]} tags={[{ id: 1, name: t('bookmark.notFound') }]} />
                                : <TagInput onChange={field.onChange} value={field.value ?? []} tags={tags || []} />}
                        <FormMessage />
                    </FormItem>
                )} />
            <FormField control={control} name="name"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('bookmark.name')}</FormLabel>
                        <FormControl><Input placeholder="Google..." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            <FormField control={control} name="description"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('bookmark.description')}</FormLabel>
                        <FormControl><Textarea placeholder={t('bookmark.description') + "..."} {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            <Label className="flex items-center gap-2 w-fit cursor-pointer">
                <Checkbox checked={uploadImage} onCheckedChange={onCheckedChange} />
                {t('bookmark.uploadImage')}
            </Label>
        </div>
    );
};
