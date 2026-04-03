// captureScreenshot is dynamically imported to prevent webextension-polyfill
// from being bundled into embeddedUI.js (which runs in page context)
import { bookmarkFormValues } from '../validators/bookmarkForm.ts';

import { bookmarkMetadata } from '../cache.ts';
import { getCurrentTabInfo } from '../utils.ts';

export async function postLink(
  baseUrl: string,
  uploadImage: boolean,
  data: bookmarkFormValues,
  setState: (state: 'capturing' | 'uploading' | null) => void,
  apiKey: string,
  aiTagged: boolean = false
) {
  if (
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    setState('capturing');
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_LINK_FROM_EXTENSION',
      data: { uploadImage, values: data, aiTagged },
    });

    if (response.success) {
      setState(null);
      return { data: response.data };
    }

    setState(null);
    throw new Error(response.error);
  }

  const url = `${baseUrl}/api/v1/links`;

  if (uploadImage) {
    setState('capturing');

    const { default: captureScreenshot } = await import('../screenshot.ts');
    const screenshot = await captureScreenshot();

    setState('uploading');

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

    const formData = new FormData();
    formData.append('file', screenshot, 'screenshot.png');

    const archiveResponse = await fetch(archiveUrl, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!archiveResponse.ok) {
      const errorText = await archiveResponse.text();
      throw new Error(`Failed to upload screenshot: ${archiveResponse.status} ${errorText}`);
    }

    setState(null);
    return { data: linkData };
  }

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
      }

      return false;
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
      encodeURIComponent(`${urlToCheck}`) + '&archived=all';

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    return data.response.length > 0;
  } catch {
    return false;
  }
}