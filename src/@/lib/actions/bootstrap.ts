import {
  BootstrapExtensionState,
  sendExtensionMessage,
} from '../runtime/messages.ts';

export async function getExtensionBootstrapState(domain?: string) {
  const response = await sendExtensionMessage<BootstrapExtensionState>(
    'BOOTSTRAP_EXTENSION_STATE',
    domain ? { domain } : {},
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to load extension bootstrap state');
  }

  return response.data;
}