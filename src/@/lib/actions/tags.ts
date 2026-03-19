

export interface ResponseTags {
  id: number;
  name: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
  archiveAsMonolith?: boolean;
  archiveAsPDF?: boolean;
  archiveAsReadable?: boolean;
  archiveAsScreenshot?: boolean;
  archiveAsWaybackMachine?: boolean;
  aiTag?: boolean;
  _count: {
    links: number;
  };
}

export async function getTags(baseUrl: string, apiKey: string) {
  // Check if running in content script (embedded menu)
  if (
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_TAGS',
    });

    if (response.success) {
      return { data: response.data };
    } else {
      throw new Error(response.error);
    }
  }

  const url = `${baseUrl}/api/v1/tags`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message || 'Failed to fetch tags');
  }

  return { data: json };
}
