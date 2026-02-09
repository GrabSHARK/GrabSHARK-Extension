export class AuthManager {

    static async verifySession(data: {
        baseUrl: string;
        username: string;
        password: string;
        method: string;
        apiKey: string;
    }) {
        const { baseUrl, username, password, method, apiKey } = data;

        try {
            if (method === 'apiKey') {
                // For API key, just return the key as token
                return { success: true, data: { token: apiKey } };
            } else {
                // Use fetch for session verification (background script has no CORS restrictions)
                const response = await fetch(`${baseUrl}/api/v1/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, sessionName: 'Browser Extension' }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const resData = await response.json();
                return { success: true, data: { token: resData.response?.token } };
            }
        } catch (e) {

            return { success: false, error: 'Authentication failed' };
        }
    }
}

