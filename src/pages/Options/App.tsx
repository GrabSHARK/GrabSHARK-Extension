import Modal from '../../@/components/Modal.tsx';
import { useEffect, useState } from 'react';
import { isConfigured } from '../../@/lib/config.ts';

const App = () => {
  // Determine initial state, though usually if they are here, they might be configured.
  // But if not, we show step 1.
  const [configChecked, setConfigChecked] = useState(false);
  const [initialStep, setInitialStep] = useState(1);

  useEffect(() => {
    (async () => {
      const configured = await isConfigured();
      setInitialStep(configured ? 3 : 1);
      setConfigChecked(true);
    })();
  }, []);

  if (!configChecked) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
      <Modal
        open={true}
        initialStep={initialStep}
        onClose={() => window.close()}
      />
    </div>
  );
};

export default App;
