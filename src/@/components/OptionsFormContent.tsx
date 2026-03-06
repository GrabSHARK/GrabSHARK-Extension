
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from './ui/Form.tsx';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    optionsFormSchema,
    optionsFormValues,
} from '../lib/validators/optionsForm.ts';
import { Input } from './ui/Input.tsx';
import { Button } from './ui/Button.tsx';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
    getConfig,
    isConfigured,
    saveConfig,
} from '../lib/config.ts';
import { toast } from '../../hooks/use-toast.ts';
import { Loader2, Globe, Shield, User, Lock, Key, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover';
import { cn } from '../lib/utils.ts';

interface OptionsFormContentProps {
    onSuccess: () => void;
    showButton?: boolean;
    onLoadingChange?: (loading: boolean) => void;
    onErrorShake?: () => void;
}

export const OptionsFormContent = ({ onSuccess, showButton = true, onLoadingChange, onErrorShake }: OptionsFormContentProps) => {
    const { t } = useTranslation();

    const form = useForm<optionsFormValues>({
        resolver: zodResolver(optionsFormSchema),
        defaultValues: {
            baseUrl: '',
            method: 'username',
            username: '',
            password: '',
            apiKey: '',
            syncBookmarks: false,
            defaultCollection: '',
        },
    });

    const { mutate: onSubmit, isLoading } = useMutation({
        mutationFn: async (values: optionsFormValues) => {
            values.baseUrl = values.baseUrl.replace(/\/$/, '');

            // Use background script for session verification to avoid CORS issues
            return new Promise<optionsFormValues & { token: string }>((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        type: 'VERIFY_SESSION',
                        data: {
                            baseUrl: values.baseUrl,
                            username: values.username,
                            password: values.password,
                            method: values.method,
                            apiKey: values.apiKey || '',
                        },
                    },
                    (response: { success: boolean; data?: { token: string }; error?: string }) => {
                        if (response?.success && response.data?.token) {
                            resolve({
                                ...values,
                                apiKey: values.apiKey || '',
                                token: response.data.token,
                            });
                        } else {
                            reject(new Error(response?.error || 'Authentication failed'));
                        }
                    }
                );
            });
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : 'Unknown error';
            onErrorShake?.(); // Trigger shake animation
            toast({
                title: t('settings.configError'),
                description: message === 'Authentication failed' ? t('settings.invalidCredentials') : t('settings.checkValues'),
                variant: 'destructive',
            });
        },
        onSuccess: async (values) => {
            await saveConfig({
                baseUrl: values.baseUrl,
                defaultCollection: values.defaultCollection,
                syncBookmarks: values.syncBookmarks,
                apiKey: values.token,
            });

            // Trigger transition immediately (removed toast notification)
            setTimeout(() => {
                onSuccess?.();
            }, 500);
        },
    });

    // Pre-fill existing config if editing
    useEffect(() => {
        (async () => {
            const configured = await isConfigured();
            if (configured) {
                const cachedOptions = await getConfig();
                form.reset(cachedOptions);
            }
        })();
    }, [form]);

    // Notify parent of loading state changes
    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const { handleSubmit, control, watch, setValue } = form;
    const method = watch('method');
    const [openMethod, setOpenMethod] = useState(false);

    return (
        <Form {...form}>
            <form id="connection-form" onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-3">

                {/* URL Input */}
                <FormField
                    control={control}
                    name="baseUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                    <Input placeholder="https://spark.myserver.com" {...field} className="bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 focus:ring-zinc-900 dark:focus:ring-zinc-100 rounded-xl h-9 text-sm pl-9 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Auth Method - Custom Dropdown */}
                <FormField
                    control={control}
                    name="method"
                    render={({ field }) => (
                        <FormItem>
                            <Popover open={openMethod} onOpenChange={setOpenMethod}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <button
                                            type="button"
                                            role="combobox"
                                            aria-expanded={openMethod}
                                            className={cn(
                                                "w-full flex items-center justify-between bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 font-normal rounded-xl h-9 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                                                <Shield className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                                <span>{field.value === 'apiKey' ? 'API Key' : 'Username & Password'}</span>
                                            </div>
                                            <ChevronDown className={cn("w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform duration-200", openMethod && "rotate-180")} />
                                        </button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-[#1a1a1c] shadow-lg" align="start" portal={false} sideOffset={2}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setValue('method', 'username');
                                            setOpenMethod(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                            field.value === 'username'
                                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        )}
                                    >
                                        <User className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                        Username & Password
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setValue('method', 'apiKey');
                                            setOpenMethod(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                            field.value === 'apiKey'
                                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        )}
                                    >
                                        <Key className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                        API Key
                                    </button>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Dynamic Auth Fields - Stacked */}
                {method === 'apiKey' ? (
                    <FormField
                        control={control}
                        name="apiKey"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                        <Input type="password" placeholder="API Key" {...field} className="bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 focus:ring-zinc-900 dark:focus:ring-zinc-100 rounded-xl h-9 text-sm pl-9 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : (
                    <div className="space-y-3">
                        <FormField
                            control={control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                            <Input placeholder="Username" {...field} className="bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 focus:ring-zinc-900 dark:focus:ring-zinc-100 rounded-xl h-9 text-sm pl-9 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                            <Input type="password" placeholder="Password" {...field} className="bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-zinc-800/50 focus:ring-zinc-900 dark:focus:ring-zinc-100 rounded-xl h-9 text-sm pl-9 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                {showButton && (
                    <Button disabled={isLoading} type="submit" className="w-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 h-9 rounded-lg font-medium text-sm mt-1">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Connect Account'}
                    </Button>
                )}
            </form>
        </Form>
    );
};
