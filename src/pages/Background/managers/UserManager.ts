import { ApiClient, type BackgroundApiConfig } from './ApiClient';

export class UserManager {
    static async getUser(config: BackgroundApiConfig) {
        try {
            const data = await ApiClient.request<{ response: any }>(config, '/api/v1/users/me');
            return { success: true, data: data.response };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch user' };
        }
    }

    static async updateUser(config: BackgroundApiConfig, userId: number, updateData: any) {
        try {
            const data = await ApiClient.request<{ response: any }>(config, `/api/v1/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            return { success: true, data: data.response };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to update user' };
        }
    }

    static async syncLocale(configured: boolean, config: BackgroundApiConfig) {
        if (!configured) {
            return { success: false, error: 'Not configured' };
        }

        try {
            const { grabshark_locale_setting } = await chrome.storage.local.get(['grabshark_locale_setting']);

            if (grabshark_locale_setting && grabshark_locale_setting !== 'system') {
                return { success: true, locale: grabshark_locale_setting, skipped: true };
            }

            const result = await this.getUser(config);
            if (result.success && result.data?.locale) {
                await chrome.storage.local.set({ grabshark_locale: result.data.locale });
                return { success: true, locale: result.data.locale };
            }

            return { success: false, error: 'No locale in user profile' };
        } catch {
            return { success: false, error: 'Failed to sync locale' };
        }
    }
}
