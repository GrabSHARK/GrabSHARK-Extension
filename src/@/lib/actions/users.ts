import { getCurrentUserProfile } from '../runtime/messages.ts';

export async function getCurrentUser(_baseUrl: string, _token: string) {
    if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime?.id) {
        return await getCurrentUserProfile();
    }

    throw new Error('Direct user fetch is no longer supported in UI contexts without runtime messaging');
}
