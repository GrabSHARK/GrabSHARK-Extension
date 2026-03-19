import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '../ui/Toast';
import { useToast } from '../../../hooks/use-toast';
import { WarningCircle } from '@phosphor-icons/react';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className='flex items-start gap-3'>
              {/* Error Icon for destructive variant */}
              {variant === 'destructive' && (
                <WarningCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" weight="fill" />
              )}
              <div className='grid gap-0.5'>
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
