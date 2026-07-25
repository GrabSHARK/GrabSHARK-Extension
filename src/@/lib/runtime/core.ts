export interface RuntimeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function sendRuntimeMessage<T>(type: string, data?: unknown): Promise<RuntimeResponse<T>> {
  try {
    return await chrome.runtime.sendMessage({ type, data });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
