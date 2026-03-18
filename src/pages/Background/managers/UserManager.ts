// import { getConfig } from '../../../@/lib/config';
import { getCurrentUser } from '../../../@/lib/actions/users';

export class UserManager {

    static async getUser(config: { baseUrl: string; apiKey: string }) {
        try {
            const response = await fetch(`${config.baseUrl}/api/v1/users/me`, {
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data.response };
            } else {
                return { success: false, error: 'Failed to fetch user' };
            }
        } catch (error) {

            return { success: false, error: String(error) };
        }
    }

    static async updateUser(
        config: { baseUrl: string; apiKey: string },
        userId: number,
        updateData: any
    ) {
        try {


            const response = await fetch(`${config.baseUrl}/api/v1/users/${userId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            const responseData = await response.json();

            if (response.ok) {
                return { success: true, data: responseData.response };
            } else {
                return { success: false, error: responseData.response || 'Failed to update user' };
            }
        } catch (error) {

            return { success: false, error: String(error) };
        }
    }

    static async syncLocale(configured: boolean, config: { baseUrl: string; apiKey: string }) {
        if (!configured) {
            return { success: false, error: 'Not configured' };
        }
        try {
            // Check if user has manually set a language preference
            const { grabshark_locale_setting } = await chrome.storage.local.get(['grabshark_locale_setting']);

            // Only sync from GrabSHARK if user selected 'system' mode or no preference set
            if (grabshark_locale_setting && grabshark_locale_setting !== 'system') {

                return { success: true, locale: grabshark_locale_setting, skipped: true };
            }

            const user = await getCurrentUser(config.baseUrl, config.apiKey);
            if (user && user.locale) {
                await chrome.storage.local.set({ grabshark_locale: user.locale });

                return { success: true, locale: user.locale };
            } else {
                return { success: false, error: 'No locale in user profile' };
            }
        } catch (e) {

            return { success: false, error: 'Failed to sync locale' };
        }
    }
}
