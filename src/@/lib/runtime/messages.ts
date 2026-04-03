export interface RuntimeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DomainPreferencePayload {
  domain: string;
  enableSmartCapture?: boolean;
  enableSelectionMenu?: boolean;
}

export interface SuggestTagsPayload {
  url: string;
  title?: string;
  description?: string;
}

export interface CachedUserPrefs {
  archiveAsScreenshot: boolean;
  archiveAsMonolith: boolean;
  archiveAsPDF: boolean;
  archiveAsReadable: boolean;
  aiTag: boolean;
}

export interface BootstrapExtensionState {
  configured: boolean;
  baseUrl?: string;
  config?: {
    baseUrl: string;
    defaultCollection: string;
    syncBookmarks: boolean;
  };
  user?: any | null;
  collections?: any[];
  tags?: any[];
  prefs?: CachedUserPrefs | null;
  domainPreference?: {
    domain?: string;
    enableSmartCapture: boolean;
    enableSelectionMenu: boolean;
    isModified?: boolean;
    globalDefaults?: {
      enableSmartCapture: boolean;
      enableSelectionMenu: boolean;
    } | null;
  } | null;
}

export async function sendExtensionMessage<T>(
  type: string,
  data?: unknown,
): Promise<RuntimeResponse<T>> {
  try {
    return await chrome.runtime.sendMessage({ type, data });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}