import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getLinksFetch } from './actions/links.ts';
import { getConfig } from './config.ts';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TabInfo {
  url: string;
  title: string;
}

export async function getCurrentTabInfo(): Promise<{ title: string | undefined; url: string | undefined }> {
  if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') {
    const tabs = await getBrowser().tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      const { url, title } = tabs[0];
      return { url, title };
    }
  }

  if (typeof window !== 'undefined') {
    return { url: window.location.href, title: document.title };
  }

  return { url: undefined, title: undefined };
}

export function getBrowser() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  return typeof browser !== 'undefined' ? browser : chrome;
}

export function getChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage;
}

export async function getStorageItem(key: string) {
  if (getChromeStorage()) {
    const result = await getBrowser().storage.local.get([key]);
    return result[key];
  } else {
    return getBrowser().storage.local.get(key);
  }
}

export const checkDuplicatedItem = async () => {
  try {
    const config = await getConfig();
    const currentTab = await getCurrentTabInfo();
    const { response } = await getLinksFetch(config.baseUrl, config.apiKey);
    const formatLinks = response.map((link) => link.url);
    return formatLinks.includes(currentTab.url ?? '');
  } catch {
    // Silently fail if not configured or network error
    return false;
  }
};

export async function setStorageItem(key: string, value: string) {
  if (getChromeStorage()) {
    return await chrome.storage.local.set({ [key]: value });
  } else {
    await getBrowser().storage.local.set({ [key]: value });
    return Promise.resolve();
  }
}

export function openOptions() {
  const browser = getBrowser();
  if (browser.runtime.openOptionsPage) {
    browser.runtime.openOptionsPage();
  } else {
    // Fallback: send message to background script
    return (browser.runtime.sendMessage as any)({ type: 'OPEN_OPTIONS_PAGE' });
  }
}
