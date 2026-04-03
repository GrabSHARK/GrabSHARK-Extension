import Container from '../../@/components/Container.tsx';
import WholeContainer from '../../@/components/WholeContainer.tsx';
import BookmarkForm from '../../@/components/BookmarkForm.tsx';
import { useCallback, useEffect, useState } from 'react';
import Modal from '../../@/components/Modal.tsx';
import { ModeToggle } from '../../@/components/ModeToggle.tsx';
import { useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { getExtensionBootstrapState } from '../../@/lib/actions/bootstrap.ts';

function App() {
  const [isAllConfigured, setIsAllConfigured] = useState<boolean>();
  const [baseUrl, setBaseUrl] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
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

  const handleModalClose = async () => {
    setShowSettings(false);
    await loadBootstrap();
  };

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
                alt="GrabSHARK Logo"
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

        <Modal
          open={!!isModalOpen}
          initialStep={initialStep}
          onClose={isAllConfigured ? handleModalClose : undefined}
        />
      </Container>
    </WholeContainer>
  );
}

export default App;