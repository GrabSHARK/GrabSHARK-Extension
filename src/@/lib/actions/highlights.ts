// Highlight API actions for browser extension

import { Highlight, HighlightCreateData, LinkWithHighlights } from '../types/highlight.ts';

/**
 * Get link by URL with its highlights
 */
export async function getLinkByUrl(
    baseUrl: string,
    url: string,
    apiKey: string
): Promise<LinkWithHighlights | null> {
    const searchUrl = `${baseUrl}/api/v1/links?searchQueryString=${encodeURIComponent(url)}&archived=all`;

    const response = await fetch(searchUrl, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {

        return null;
    }

    const data = await response.json();
    const links = data.response;

    if (!links || links.length === 0) {
        return null;
    }

    // Find exact URL match
    const exactMatch = links.find((link: LinkWithHighlights) => link.url === url);
    return exactMatch || null;
}

/**
 * Get highlights for a specific link
 */
export async function getLinkHighlights(
    baseUrl: string,
    linkId: number,
    apiKey: string
): Promise<Highlight[]> {
    const url = `${baseUrl}/api/v1/links/${linkId}/highlights`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {

        return [];
    }

    const data = await response.json();
    return data.response || [];
}

/**
 * Create or update a highlight
 */
export async function postHighlight(
    baseUrl: string,
    data: HighlightCreateData,
    apiKey: string
): Promise<Highlight | null> {
    const url = `${baseUrl}/api/v1/highlights`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {


        return null;
    }

    const result = await response.json();
    return result.response;
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(
    baseUrl: string,
    highlightId: number,
    apiKey: string
): Promise<boolean> {
    const url = `${baseUrl}/api/v1/highlights/${highlightId}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {

        return false;
    }

    return true;
}

/**
 * Create a new link (for auto-save when highlighting on unsaved page)
 */
export async function createLinkForHighlight(
    baseUrl: string,
    pageUrl: string,
    pageTitle: string,
    apiKey: string
): Promise<LinkWithHighlights | null> {
    const url = `${baseUrl}/api/v1/links`;

    // Resolve default collection by ID, not hardcoded name
    let collection: any = {};
    try {
        const colResponse = await fetch(`${baseUrl}/api/v1/collections`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (colResponse.ok) {
            const colData = await colResponse.json();
            const collections = colData.response || [];
            const defaultCol = collections.find((c: any) => c.isDefault === true);
            if (defaultCol) {
                collection = { name: defaultCol.name, id: defaultCol.id, ownerId: defaultCol.ownerId };
            }
        }
    } catch (e) {
        // Fallback to name-only
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            url: pageUrl,
            name: pageTitle,
            description: '',
            collection,
            tags: [],
        }),
    });

    if (!response.ok) {


        return null;
    }

    const result = await response.json();
    return result.response;
}
