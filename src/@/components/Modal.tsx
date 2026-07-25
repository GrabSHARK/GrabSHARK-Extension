import { FC, useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button.tsx';
import { cn } from '../lib/utils.ts';
import { OptionsFormContent } from './OptionsFormContent';
import { Moon, Sun, Monitor, Link2, X, ChevronLeft, Loader2 } from 'lucide-react';
import { Toaster } from './ui/Toaster.tsx';
import { useTheme } from './ThemeProvider.tsx';

interface ModalProps {
  open: boolean;
  initialStep?: number;
  onClose?: () => void;
  onDone?: (linkExists: boolean) => void;
}

const Modal: FC<ModalProps> = ({ open, initialStep = 1, onClose, onDone }) => {
  const [step, setStep] = useState(initialStep);
  const { theme, setTheme } = useTheme();
  const [isClosing, setIsClosing] = useState(false);
  const [linkExists, setLinkExists] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setIsClosing(false);
    }
  }, [open, initialStep]);

  useEffect(() => {
    if (step === 3) {
      chrome.runtime.sendMessage({ type: 'CHECK_LINK_EXISTS' }, (response) => {
        if (response && typeof response.exists === 'boolean') {
          setLinkExists(response.exists);
        }
      });
    }
  }, [step]);

  useEffect(() => {
    if (!contentRef.current) return;

    const updateHeight = () => {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.offsetHeight);
        }
      });
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(contentRef.current);

    const timeout = setTimeout(updateHeight, 50);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [step, isClosing]);

  const handleDone = () => {
    setIsClosing(true);
    setTimeout(() => {
      if (onDone) {
        onDone(linkExists);
      } else if (onClose) {
        onClose();
      }
    }, 300);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  if (!open) return null;

  const logoSrc = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
    ? chrome.runtime.getURL('48.png')
    : '48.png';
  return (
    <div className={cn(
      'relative z-50 flex flex-col items-center bg-void-bg px-3 pt-2 pb-[68px] rounded-2xl transition-all duration-300',
      isClosing && 'opacity-0 scale-95'
    )}>
      <div className={cn(
        'w-full max-w-[280px] flex items-center justify-between mb-3 transition-opacity duration-300',
        step === 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}>
        {step === 2 ? (
          <button
            onClick={() => setStep(1)}
            className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-7 h-7" />
        )}

        {onClose && (
          <button
            onClick={handleClose}
            className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded-full transition-colors text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {(step === 1 || step === 2 || step === 3) && (
        <div className={cn(
          'shrink-0 w-14 h-14 flex items-center justify-center transition-all duration-500 ease-out',
          step === 1 ? 'mb-[72px]' : 'mb-7'
        )}>
          <img
            src={logoSrc}
            alt="GrabSHARK"
            className={cn(
              'w-14 h-14 transition-all duration-500 ease-out origin-top',
              step === 2 && 'scale-[0.75]'
            )}
            style={{
              filter: (step === 1 || step === 3)
                ? (theme === 'light'
                  ? 'drop-shadow(0 0 6px rgba(13, 148, 136, 0.85)) drop-shadow(0 0 12px rgba(13, 148, 136, 0.75)) drop-shadow(0 0 24px rgba(13, 148, 136, 0.65)) drop-shadow(0 0 36px rgba(13, 148, 136, 0.5))'
                  : 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.85)) drop-shadow(0 0 12px rgba(6, 182, 212, 0.75)) drop-shadow(0 0 24px rgba(6, 182, 212, 0.6)) drop-shadow(0 0 36px rgba(6, 182, 212, 0.45))')
                : (theme === 'light'
                  ? 'drop-shadow(0 0 4px rgba(13, 148, 136, 0.8)) drop-shadow(0 0 8px rgba(13, 148, 136, 0.6)) drop-shadow(0 0 16px rgba(13, 148, 136, 0.4))'
                  : 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.8)) drop-shadow(0 0 8px rgba(6, 182, 212, 0.6)) drop-shadow(0 0 16px rgba(6, 182, 212, 0.4))')
            }}
          />
        </div>
      )}

      {(step === 1 || step === 2 || step === 3) && (
        <div
          className={cn(
            'relative w-full max-w-[280px] bg-void-island/60 backdrop-blur-xl rounded-3xl shadow-xl shadow-black/40 border border-void-border/20 transition-all duration-500 ease-out',
            step === 2 && '-translate-y-[12px]',
            isClosing && 'translate-y-4 opacity-0'
          )}
          style={{ height: contentHeight ? `${contentHeight}px` : 'auto' }}
        >
          <div ref={contentRef}>
            {step === 1 && (
              <div className="p-6 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in duration-300 fill-mode-forwards">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Welcome to GrabSHARK</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Connect your account to start.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="p-[15px] flex flex-col animate-in fade-in duration-300 fill-mode-forwards">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed text-center mb-4">
                  Enter your instance details
                </p>
                <OptionsFormContent
                  onSuccess={() => setStep(3)}
                  showButton={false}
                  onLoadingChange={setIsConnecting}
                  onErrorShake={() => {
                    setHasError(true);
                    setTimeout(() => setHasError(false), 500);
                  }}
                />
              </div>
            )}

            {step === 3 && (
              <div className="p-6 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in duration-300 fill-mode-forwards">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">All Set!</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Connection successful.<br />
                  Your setup is complete and you're ready to start.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'w-full max-w-[280px] grid transition-all duration-500 ease-out mt-5',
          step === 1 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden flex items-center justify-center">
          <div className="flex items-center justify-center gap-2 py-3">
            <button
              onClick={() => setTheme('dark')}
              title="Dark"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${theme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-zinc-200 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('light')}
              title="Light"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${theme === 'light' ? 'bg-primary text-primary-foreground' : 'bg-zinc-200 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('website')}
              title="Follow Website"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${theme === 'website' ? 'bg-primary text-primary-foreground' : 'bg-zinc-200 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('system')}
              title="Follow GrabSHARK"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${theme === 'system' ? 'bg-primary text-primary-foreground' : 'bg-zinc-200 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex justify-center">
        <div className="w-full max-w-[280px]">
          {step === 3 && <div className="h-[22px]" />}
          <div className="relative w-full h-11">
            <Button
              onClick={() => setStep(2)}
              type="button"
              className={cn(
                'absolute inset-0 w-full h-11 rounded-2xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_hsl(var(--primary)/0.45)] transition-all duration-300',
                step === 1 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              )}
            >
              Start
            </Button>

            <Button
              type="submit"
              form="connection-form"
              disabled={isConnecting}
              className={cn(
                'absolute inset-0 w-full h-11 rounded-2xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_hsl(var(--primary)/0.45)] transition-all duration-300',
                step === 2 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                hasError && 'animate-shake'
              )}
            >
              {isConnecting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                'Connect Account'
              )}
            </Button>

            <Button
              onClick={handleDone}
              type="button"
              className={cn(
                'absolute inset-0 w-full h-11 rounded-2xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.2),0_0_28px_hsl(var(--primary)/0.45)] transition-all duration-300',
                step === 3 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              )}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default Modal;
