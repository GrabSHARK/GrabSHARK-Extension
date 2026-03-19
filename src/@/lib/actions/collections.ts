

export interface ResponseCollections {
  color: string;
  createdAt: string;
  description: string;
  id: number;
  isPublic: boolean;
  members: never[]; // Assuming members can be of any type, adjust as necessary
  name: string;
  ownerId: number;
  parent: null | {
    id: number;
    name: string;
  };
  parentId: null | number; // Assuming parentId can be null or a number
  updatedAt: string;
  pathname?: string;
}

function buildFullPath(
  collection: ResponseCollections,
  collectionsMap: Map<number, ResponseCollections>
): string {
  const paths: string[] = [collection.name];
  let currentParent = collection.parent;

  while (currentParent) {
    paths.unshift(currentParent.name);
    const parentCollection = collectionsMap.get(currentParent.id);
    currentParent = parentCollection?.parent || null;
  }

  return paths.join(' > ');
}

export async function getCollections(baseUrl: string, apiKey: string) {
  // Check if running in content script (embedded menu)
  if (
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_COLLECTIONS',
    });

    if (response.success) {
      return { data: response.data };
    } else {
      throw new Error(response.error);
    }
  }

  const url = `${baseUrl}/api/v1/collections`;

  const fetchResponse = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = await fetchResponse.json();

  // Create a map for quick lookups
  const collectionsMap = new Map<number, ResponseCollections>(
    (data.response as ResponseCollections[]).map((collection) => [collection.id, collection])
  );

  // Format the collection names with full parent structure
  const formattedCollections = (data.response as ResponseCollections[]).map((collection) => ({
    ...collection,
    pathname: buildFullPath(collection, collectionsMap),
  }));

  return {
    ...fetchResponse,
    data: {
      response: formattedCollections,
    },
  };
}
