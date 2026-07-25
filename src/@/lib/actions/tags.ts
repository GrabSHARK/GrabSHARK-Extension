import { getTagsData } from '../runtime/messages.ts';

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
  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime?.id) {
    return { data: await getTagsData() };
  }

  const url = `${baseUrl}/api/v1/tags`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || 'Failed to fetch tags');
  }

  return { data: json };
}
