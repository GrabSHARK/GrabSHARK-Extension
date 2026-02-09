export async function getCurrentUser(baseUrl: string, token: string) {
    // Check if running in content script (embedded menu)
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_USER'
            });

            if (response.success) {
                return response.data;
            } else {
                throw new Error(response.error || 'Failed to fetch user via proxy');
            }
        } catch (e) {
            throw e;
        }
    }

    const response = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user');
    }

    const data = await response.json();
    return data.response; // Assuming standard API response wrapper
}
