import { getCollectionsData } from '../runtime/messages.ts';

export interface ResponseCollections {
  color: string;
  createdAt: string;
  description: string;
  id: number;
  isPublic: boolean;
  members: never[];
  name: string;
  ownerId: number;
  parent: null | { id: number; name: string };
  parentId: null | number;
  updatedAt: string;
  pathname?: string;
  isDefault?: boolean;
}

function buildFullPath(collection: ResponseCollections, collectionsMap: Map<number, ResponseCollections>): string {
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
  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime?.id) {
    return { data: await getCollectionsData() };
  }

  const url = `${baseUrl}/api/v1/collections`;
  const fetchResponse = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const data = await fetchResponse.json();
  const collectionsMap = new Map<number, ResponseCollections>((data.response as ResponseCollections[]).map((collection) => [collection.id, collection]));
  const formattedCollections = (data.response as ResponseCollections[]).map((collection) => ({
    ...collection,
    pathname: buildFullPath(collection, collectionsMap),
  }));

  return { ...fetchResponse, data: { response: formattedCollections } };
}
