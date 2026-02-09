import captureScreenshot from '../screenshot.ts';
import { bookmarkFormValues } from '../validators/bookmarkForm.ts';

import { bookmarkMetadata } from '../cache.ts';
import { getCurrentTabInfo } from '../utils.ts';

export async function postLink(
  baseUrl: string,
  uploadImage: boolean,
  data: bookmarkFormValues,
  setState: (state: 'capturing' | 'uploading' | null) => void,
  apiKey: string,
  aiTagged: boolean = false // Prevent worker re-tagging if true
) {
  // Check if running in content script (embedded menu)
  if (
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    setState('capturing'); // Simulate state
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_LINK_FROM_EXTENSION',
      data: { uploadImage, values: data },
    });

    if (response.success) {
      setState(null);
      return { data: response.data };
    } else {
      setState(null);
      throw new Error(response.error);
    }
  }

  const url = `${baseUrl}/api/v1/links`;

  if (uploadImage) {
    setState('capturing');

    const screenshot = await captureScreenshot();

    setState('uploading');

    // Step 1: Create Link
    const linkResponse = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ ...data, aiTagged }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!linkResponse.ok) {
      const errorText = await linkResponse.text();
      throw new Error(`Failed to create link: ${linkResponse.status} ${errorText}`);
    }

    const linkData = await linkResponse.json();
    const { id } = linkData.response;
    const archiveUrl = `${baseUrl}/api/v1/archives/${id}?format=0&skipPreview=true`;

    // Step 2: Upload Screenshot
    const formData = new FormData();
    formData.append('file', screenshot, 'screenshot.png');

    const archiveResponse = await fetch(archiveUrl, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Note: Do NOT set Content-Type for FormData, browser sets it with boundary
      },
    });

    if (!archiveResponse.ok) {
      // Log warning but don't fail the whole process if archive fails? 
      // Or throw? Original code threw.
      const errorText = await archiveResponse.text();
      throw new Error(`Failed to upload screenshot: ${archiveResponse.status} ${errorText}`);
    }

    setState(null);

    return { data: linkData }; // Mimic Axios response structure used by caller? 
    // Caller (Background) expects `result.data`. 
    // If I return `{ data: linkData }` where `linkData` is `{ response: ... }`, then `result.data` is `{ response: ... }`.
    // Background sends `result.data` to content script.

  } else {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ ...data, aiTagged }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create link: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    return { data: responseData };
  }
}

export async function postLinkFetch(
  baseUrl: string,
  data: bookmarkFormValues,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links`;

  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function updateLinkFetch(
  baseUrl: string,
  id: number,
  data: bookmarkFormValues,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links/${id}`;

  return await fetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function deleteLinkFetch(
  baseUrl: string,
  id: number,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links/${id}`;

  return await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function getLinksFetch(
  baseUrl: string,
  apiKey: string
): Promise<{ response: bookmarkMetadata[] }> {
  // Check if running in content script (embedded menu)
  if (
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    try {
      // We can reuse the same message type or create a new one. 
      // Previously we didn't have a GET_LINKS message, but we have GET_COLLECTIONS.
      // Actually, for checking duplicates we need all links? That's heavy.
      // CHECK_LINK_EXISTS (already used) is better than fetching all links.
      // But checkDuplicatedItem implements its own logic: fetch ALL, map urls, check include.
      // This is inefficient but assuming we keep it:

      // We need to add GET_LINKS handler in background.
      // Or better: Reimplement checking logic in Utils to use checkLinkExists if possible.
      // But getLinksFetch might be used elsewhere.

      // Let's add PROXY logic here assuming background handles 'GET_LINKS' or similar?
      // Wait, background/index.ts does NOT implement GET_LINKS.
      // I should probably refrain from proxying it blindly if it's not handled.
      // Let's check background/index.ts again or just fix checkDuplicatedItem.

      // Actually, checkDuplicatedItem implementation:
      // const { response } = await getLinksFetch(config.baseUrl, config.apiKey);
      // const formatLinks = response.map((link) => link.url);
      // return formatLinks.includes(currentTab.url ?? '');

      // This is equivalent to checkLinkExists!
      // We should replace usage of getLinksFetch in utils.ts with checkLinkExists if possible.
      // But getLinksFetch signature returns all links.

      // If I proxy it, I must implement the handler in background.
      // If I don't proxy it, it will fail on CSP pages.

      // Best approach: Add GET_LINKS to background handlers.
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LINKS'
      });

      if (response.success) {
        return response.data;
      } else {
        return { response: [] };
      }
    } catch {
      return { response: [] };
    }
  }

  const url = `${baseUrl}/api/v1/links`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  return await response.json();
}

export async function checkLinkExists(
  baseUrl: string,
  apiKey: string,
  targetUrl?: string
): Promise<boolean> {
  try {
    // Check if running in content script (embedded menu) gets proxying
    if (
      typeof window !== 'undefined' &&
      window.location.protocol.startsWith('http')
    ) {
      const url = targetUrl || window.location.href;

      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_LINK_EXISTS',
        data: { url },
      });

      if (response.success) {
        return response.data;
      } else {
        return false;
      }
    }

    let urlToCheck = targetUrl;

    if (!urlToCheck) {
      const tabInfo = await getCurrentTabInfo();
      if (!tabInfo.url) {
        return false;
      }
      urlToCheck = tabInfo.url;
    }

    const url =
      `${baseUrl}/api/v1/links?cursor=0&sort=0&searchQueryString=` +
      encodeURIComponent(`${urlToCheck}`) + "&archived=all";

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    const exists = data.response.length > 0;
    return exists;
  } catch {
    // Silently fail if not configured or network error
    return false;
  }
}
