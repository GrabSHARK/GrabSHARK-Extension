// ./OptionsForm.tsx

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './ui/Form.tsx';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { optionsFormSchema, optionsFormValues } from '../lib/validators/optionsForm.ts';
import { Input } from './ui/Input.tsx';
import { Button } from './ui/Button.tsx';
import { useState, useEffect } from 'react';
import { getConfig, isConfigured, saveConfig, clearConfig } from '../lib/config.ts';
import { Toaster } from './ui/Toaster.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select.tsx';
import { useTheme } from './ThemeProvider.tsx';
import { Separator } from './ui/Separator.tsx';
import { useMutation } from '@tanstack/react-query';
import { toast } from '../../hooks/use-toast';
import { AxiosError } from 'axios';
import { clearBookmarksMetadata } from '../lib/cache';
import { getSession } from '../lib/auth/auth';

// --- Options Form Mutations (inlined from useOptionsFormMutations) ---

function useOptionsFormMutations({ form, t }: { form: any; t: (key: string) => string }) {
  const [hasError, setHasError] = useState(false);

  const { mutate: onReset, isLoading: resetLoading } = useMutation({
    mutationFn: async () => { if (!(await isConfigured())) return new Error('Not configured'); },
    onError: () => { toast({ title: t('settings.configError'), description: t('settings.notConfiguredDesc'), variant: 'destructive' }); },
    onSuccess: async () => {
      form.reset({ baseUrl: '', method: 'username', username: '', password: '', apiKey: '', syncBookmarks: false, defaultCollection: '' });
      await clearConfig(); await clearBookmarksMetadata();
    },
  });

  const { mutate: onSubmit, isLoading } = useMutation({
    mutationFn: async (values: any) => {
      values.baseUrl = values.baseUrl.replace(/\/$/, '');
      if (values.method === 'apiKey') {
        return { ...values, data: { response: { token: values.apiKey } } as { response: { token: string } } };
      }
      const session = await getSession(values.baseUrl, values.username, values.password);
      if (session.status !== 200) throw new Error('Invalid credentials');
      return { ...values, data: session.data as { response: { token: string } } };
    },
    onError: (error) => {
      setHasError(true);
      setTimeout(() => setHasError(false), 500);
      if (error instanceof AxiosError) {
        toast({ title: t('settings.configError'), description: error.response?.status === 401 ? t('settings.invalidCredentials') : t('settings.genericError'), variant: 'destructive' });
      } else { toast({ title: t('settings.configError'), description: t('settings.checkValues'), variant: 'destructive' }); }
    },
    onSuccess: async (values) => {
      await saveConfig({ baseUrl: values.baseUrl, defaultCollection: values.defaultCollection, syncBookmarks: values.syncBookmarks, apiKey: values.method === 'apiKey' && values.apiKey ? values.apiKey : values.data.response.token });
      toast({ title: t('settings.savedTitle'), description: t('settings.savedDesc'), variant: 'default' });
      setTimeout(() => window.close(), 1500);
    },
  });

  return { onReset, resetLoading, onSubmit, isLoading, hasError };
}

// --- Connection Fields (inlined from ConnectionFields) ---

const ConnectionFields = ({ control, method }: { control: any; method: string }) => (
  <>
    <FormField control={control} name="method"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Method</FormLabel>
          <FormDescription>Choose your preferred authentication method.</FormDescription>
          <FormControl>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full justify-between bg-neutral-100 dark:bg-neutral-900 outline-none focus:outline-none ring-0 focus:ring-0">
                <SelectValue placeholder="Select authentication method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="username">Username and Password</SelectItem>
                <SelectItem value="apiKey">API Key</SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

    {method === 'apiKey' ? (
      <FormField control={control} name="apiKey"
        render={({ field }) => (
          <FormItem>
            <FormLabel>API Key</FormLabel>
            <FormDescription>Enter your GrabSHARK API Key.</FormDescription>
            <FormControl><Input placeholder="Your API Key" {...field} type="password" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
    ) : (<>
      <FormField control={control} name="username"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Username or Email</FormLabel>
            <FormDescription>Your GrabSHARK Username or Email.</FormDescription>
            <FormControl><Input placeholder="johnny" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      <FormField control={control} name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormDescription>Password for your GrabSHARK account.</FormDescription>
            <FormControl><Input placeholder="••••••••••••••" {...field} type="password" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
    </>)}
  </>
);

// --- OptionsForm Component ---

const OptionsForm = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const form = useForm<optionsFormValues>({
    resolver: zodResolver(optionsFormSchema),
    defaultValues: { baseUrl: '', method: 'username', username: '', password: '', apiKey: '', syncBookmarks: false, defaultCollection: '' },
  });

  const { onReset, resetLoading, onSubmit, isLoading, hasError } = useOptionsFormMutations({ form, t });
  const { handleSubmit, control, watch } = form;
  const method = watch('method');

  useEffect(() => { (async () => { if (await isConfigured()) form.reset(await getConfig()); })(); }, [form]);

  return (
    <div>
      <Form {...form}>
        <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-2 p-2">
          <FormField control={control} name="baseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormDescription>The address of the GrabSHARK instance.</FormDescription>
                <FormControl><Input placeholder="http://localhost:3000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

          <Separator className="my-4" />
          <h2 className="text-base font-semibold mb-2">Appearance</h2>
          <FormItem className="mb-4">
            <FormLabel>Theme</FormLabel>
            <FormDescription>Select the extension theme preference.</FormDescription>
            <FormControl>
              <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                <SelectTrigger className="w-full justify-between bg-neutral-100 dark:bg-neutral-900 outline-none focus:outline-none ring-0 focus:ring-0">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="website">Follow Website</SelectItem>
                  <SelectItem value="system">Follow GrabSHARK</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>

          <Separator className="my-4" />
          <h2 className="text-base font-semibold mb-2">Connection</h2>
          <ConnectionFields control={control} method={method} />

          <div className="flex justify-between">
            <div>
              {/* @ts-ignore */}
              <Button type="button" className="mb-2" onClick={() => onReset()} disabled={resetLoading}>Reset</Button>
            </div>
            <Button disabled={isLoading} type="submit" className={hasError ? 'animate-shake' : ''}>
              {isLoading ? (<>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>Connecting...</>) : 'Save'}
            </Button>
          </div>
        </form>
      </Form>
      <Toaster />
    </div>
  );
};

export default OptionsForm;
