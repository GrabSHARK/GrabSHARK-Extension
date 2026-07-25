import type { ResponseCollections } from '../../../@/lib/actions/collections';
import type { ResponseTags } from '../../../@/lib/actions/tags';
import { ApiClient, type BackgroundApiConfig } from './ApiClient';

function buildFullPath(collection: ResponseCollections, collectionsMap: Map<number, ResponseCollections>) {
    const paths: string[] = [collection.name];
    let currentParent = collection.parent;

    while (currentParent) {
        paths.unshift(currentParent.name);
        const parentCollection = collectionsMap.get(currentParent.id);
        currentParent = parentCollection?.parent || null;
    }

    return paths.join(' > ');
}

export class CollectionsManager {
    static async getCollections(config: BackgroundApiConfig) {
        try {
            const data = await ApiClient.request<{ response: ResponseCollections[] }>(config, '/api/v1/collections');
            const collections = Array.isArray(data.response) ? data.response : [];
            const collectionsMap = new Map<number, ResponseCollections>(
                collections.map((collection) => [collection.id, collection]),
            );

            const formattedCollections = collections.map((collection) => ({
                ...collection,
                pathname: buildFullPath(collection, collectionsMap),
            }));

            return { success: true, data: { response: formattedCollections } };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch collections' };
        }
    }

    static async getTags(config: BackgroundApiConfig) {
        try {
            const data = await ApiClient.request<{ response: ResponseTags[] }>(config, '/api/v1/tags');
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch tags' };
        }
    }
}
