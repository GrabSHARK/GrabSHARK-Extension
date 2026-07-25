import { sendRuntimeMessage } from '../../../@/lib/runtime/core';
import type { RuntimeResponse } from '../../../@/lib/runtime/core';

export type { RuntimeResponse } from '../../../@/lib/runtime/core';

/**
 * Send message to background script
 */
export function sendMessage<T>(type: string, data?: unknown): Promise<RuntimeResponse<T>> {
    return sendRuntimeMessage<T>(type, data);
}
