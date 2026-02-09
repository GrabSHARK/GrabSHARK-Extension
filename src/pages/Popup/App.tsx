import Container from '../../@/components/Container.tsx';
import WholeContainer from '../../@/components/WholeContainer.tsx';
import BookmarkForm from '../../@/components/BookmarkForm.tsx';
import { useEffect, useState } from 'react';
import { getConfig, isConfigured } from '../../@/lib/config.ts';
import Modal from '../../@/components/Modal.tsx';
import { ModeToggle } from '../../@/components/ModeToggle.tsx';
import { useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';

function App() {
  const [isAllConfigured, setIsAllConfigured] = useState<boolean>();
  const [baseUrl, setBaseUrl] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      const cachedOptions = await isConfigured();
      const cachedConfig = await getConfig();
      setBaseUrl(cachedConfig.baseUrl);
      setIsAllConfigured(cachedOptions);

      // Prefetch tags
      if (cachedOptions) {
        queryClient.prefetchQuery({
          queryKey: ['tags'],
          queryFn: async () => {
            const response = await chrome.runtime.sendMessage({ type: 'GET_TAGS' });
            return response.data || [];
          },
          staleTime: 5 * 60 * 1000,
        });
      }
    })();
  }, [isAllConfigured]); // Re-run when configured status changes

  // Triggered when Modal (Preferences) closes or resets
  const handleModalClose = async () => {
    setShowSettings(false);
    // Re-check config in case of reset
    const configured = await isConfigured();
    setIsAllConfigured(configured);
  }

  // Ensure Modal is open if not configured (Step 1) OR if requested (Step 3)
  const isModalOpen = !isAllConfigured || showSettings;
  const initialStep = !isAllConfigured ? 1 : 3;

  return (
    <WholeContainer>
      <Container>
        <div className="flex justify-between w-full items-center">
          <div className="flex space-x-2 w-full items-center">
            <a
              href={baseUrl}
              rel="noopener"
              target="_blank"
              referrerPolicy="no-referrer"
              className="hover:opacity-80 duration-200 rounded ease-in-out"
            >
              <img
                src="./128.png"
                height="30px"
                width="30px"
                className="rounded"
                alt="SPARK Logo"
              />
            </a>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Add Link</h1>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <ModeToggle />
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <BookmarkForm />

        {/* Unified Wizard Modal */}
        <Modal
          open={!!isModalOpen}
          initialStep={initialStep}
          onClose={isAllConfigured ? handleModalClose : undefined} // Only allow close if configured
        />
      </Container>
    </WholeContainer>
  );
}

export default App;
