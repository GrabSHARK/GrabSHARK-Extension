import { bookmarkFormValues } from '../validators/bookmarkForm.ts';
import { bookmarkMetadata } from '../cache.ts';
import { getCurrentTabInfo } from '../utils.ts';
import { checkLinkExistsMessage, saveLinkFromExtension } from '../runtime/messages.ts';

export async function postLink(
  baseUrl: string,
  uploadImage: boolean,
  data: bookmarkFormValues,
  setState: (state: 'capturing' | 'uploading' | null) => void,
  apiKey: string,
  aiTagged: boolean = false
) {
  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime?.id) {
    setState(uploadImage ? 'capturing' : null);
    const response = await saveLinkFromExtension({ ...data, uploadImage }, aiTagged);
    setState(null);
    return { data: { response } };
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

    const duplicate = await readDuplicateConflict(linkResponse);
    if (duplicate) {
      setState(null);
      return { data: duplicate };
    }

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

  const duplicate = await readDuplicateConflict(response);
  if (duplicate) return { data: duplicate };

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create link: ${response.status} ${errorText}`);
  }

  const responseData = await response.json();
  return { data: responseData };
}

/**
 * Sunucu aynı URL zaten arşivdeyse 409 + künye döner. Bu bir hata değil,
 * kullanıcıya sorulacak bir karardır ("yeni versiyon olarak arşivle" mi,
 * "mevcut versiyonu aç" mı) — bu yüzden throw etmeden yukarı taşınır.
 */
export async function readDuplicateConflict(response: Response) {
  if (response.status !== 409) return null;

  try {
    const body = await response.clone().json();
    if (body?.response?.code === 'DUPLICATE_URL')
      return { duplicate: true as const, conflict: body.response };
  } catch {
    /* gövde JSON değilse normal hata akışına düşsün */
  }

  return null;
}

/** Var olan bir linkin grubuna yeni bir versiyon (snapshot) ekler. */
export async function postLinkVersion(baseUrl: string, linkId: number, apiKey: string) {
  const response = await fetch(`${baseUrl}/api/v1/links/${linkId}/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create version: ${response.status} ${errorText}`);
  }

  return await response.json();
}

export async function postLinkFetch(baseUrl: string, data: bookmarkFormValues, apiKey: string) {
  return await fetch(`${baseUrl}/api/v1/links`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function updateLinkFetch(baseUrl: string, id: number, data: bookmarkFormValues, apiKey: string) {
  return await fetch(`${baseUrl}/api/v1/links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function deleteLinkFetch(baseUrl: string, id: number, apiKey: string) {
  return await fetch(`${baseUrl}/api/v1/links/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export async function getLinksFetch(baseUrl: string, apiKey: string): Promise<{ response: bookmarkMetadata[] }> {
  const response = await fetch(`${baseUrl}/api/v1/links`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return await response.json();
}

export async function checkLinkExists(baseUrl: string, apiKey: string, targetUrl?: string): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime?.id) {
      const url = targetUrl || window.location.href;
      return await checkLinkExistsMessage(url);
    }

    let urlToCheck = targetUrl;
    if (!urlToCheck) {
      const tabInfo = await getCurrentTabInfo();
      if (!tabInfo.url) return false;
      urlToCheck = tabInfo.url;
    }

    const url = `${baseUrl}/api/v1/links?cursor=0&sort=0&searchQueryString=` + encodeURIComponent(`${urlToCheck}`) + '&archived=all';
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = await response.json();
    return data.response.length > 0;
  } catch {
    return false;
  }
}
