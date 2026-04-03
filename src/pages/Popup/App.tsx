import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getExtensionBootstrapState } from '../../@/lib/actions/bootstrap.ts';
import { OptionsFormContent } from '../../@/components/OptionsFormContent.tsx';

const BookmarkForm = lazy(() => import('../../@/components/BookmarkForm.tsx'));
const PreferencesView = lazy(() => import('../../@/components/PreferencesView.tsx').then((module) => ({ default: module.PreferencesView })));
const ModeToggle = lazy(() => import('../../@/components/ModeToggle.tsx').then((module) => ({ default: module.ModeToggle })));

function App() {
  const [isAllConfigured, setIsAllConfigured] = useState<boolean>();
  const [baseUrl, setBaseUrl] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const queryClient = useQueryClient();

  const loadBootstrap = useCallback(async () => {
    try {
      const bootstrap = await getExtensionBootstrapState();
      setBaseUrl(bootstrap.baseUrl || bootstrap.config?.baseUrl || '');
      setIsAllConfigured(bootstrap.configured);

      queryClient.setQueryData(['extensionBootstrap'], bootstrap);
      queryClient.setQueryData(['tags'], bootstrap.tags || []);
      queryClient.setQueryData(['collections'], bootstrap.collections || []);
      queryClient.setQueryData(['userProfile'], bootstrap.user || null);
    } catch {
      setIsAllConfigured(false);
      setBaseUrl('');
    }
  }, [queryClient]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const handleSettingsClose = async () => {
    setShowSettings(false);
    await loadBootstrap();
  };

  const isConfigured = !!isAllConfigured;
  const title = !isConfigured ? 'Connect Account' : showSettings ? 'Preferences' : 'Add Link';

  return (
    <div className="w-[396px] max-w-[396px] min-h-0 bg-void-bg px-6 py-4">
      {showSettings && isConfigured ? (
        <Suspense fallback={<div className="h-40 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />}>
          <PreferencesView onClose={handleSettingsClose} onBack={handleSettingsClose} />
        </Suspense>
      ) : (
        <>
          <div className="flex justify-between w-full items-center gap-3">
            <div className="flex space-x-2 w-full min-w-0 items-center">
              {baseUrl ? (
                <a
                  href={baseUrl}
                  rel="noopener"
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className="hover:opacity-80 duration-200 rounded ease-in-out shrink-0"
                >
                  <img src="./128.png" height="30px" width="30px" className="rounded" alt="GrabSHARK Logo" />
                </a>
              ) : (
                <img src="./128.png" height="30px" width="30px" className="rounded shrink-0" alt="GrabSHARK Logo" />
              )}
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">{title}</h1>
            </div>
            <div className="flex items-center justify-center space-x-2 shrink-0">
              <Suspense fallback={<div className="h-8 w-8 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />}>
                <ModeToggle />
              </Suspense>
              {isConfigured && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                  aria-label="Open settings"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.3.46.65.6 1 .1.32.35.57.67.67.35.14.7.34 1 .6a1.65 1.65 0 0 0 1 .33H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1 .33 1.65 1.65 0 0 0-.51 1.07Z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {isConfigured ? (
            <Suspense fallback={<div className="mt-4 h-40 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />}>
              <BookmarkForm />
            </Suspense>
          ) : (
            <div className="mt-4 flex flex-col items-center text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[320px] leading-relaxed">
                Point the extension to your GrabSHARK instance to start saving links.
              </p>

              <div className="mt-6 mb-4 w-14 h-14 flex items-center justify-center">
                <img
                  src="./48.png"
                  alt="GrabSHARK"
                  className="w-14 h-14"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.85)) drop-shadow(0 0 12px rgba(6, 182, 212, 0.75)) drop-shadow(0 0 24px rgba(6, 182, 212, 0.6))'
                  }}
                />
              </div>

              <div className="w-full pt-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-4">
                  Enter your instance details
                </p>
                <OptionsFormContent
                  onSuccess={() => {
                    void loadBootstrap();
                  }}
                  onLoadingChange={setIsConnecting}
                />
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 py-1">
                <div className={`h-2 w-2 rounded-full transition-colors ${isConnecting ? 'bg-blue-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isConnecting ? 'Connecting to your instance...' : 'Self-hosted and local instances are supported.'}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
