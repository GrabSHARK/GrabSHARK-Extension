import { getCurrentUser } from '../../@/lib/actions/users';
import { getConfig } from '../../@/lib/config';
import { getBrowser } from '../../@/lib/utils';
import { BadgeManager } from './managers/BadgeManager';
import { BookmarksManager } from './managers/BookmarksManager';
import { ContextManager } from './managers/ContextManager';
import { LinkUrlSyncManager } from './managers/LinkUrlSyncManager';
import { MessageRouter } from './managers/MessageRouter';

const browser = getBrowser();
const SMART_CAPTURE_COMMAND = 'toggle-smart-capture';

function isInjectableUrl(url?: string): boolean {
  return !!url && /^(https?:|file:)/.test(url);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMessageToTab(tabId: number, type: string) {
  return browser.tabs.sendMessage(tabId, { type });
}

async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['contentScript.css'],
    });
  } catch {
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScript.js'],
    });
    return true;
  } catch {
    return false;
  }
}

async function toggleEmbeddedMenuOnTab(tabId: number, url?: string): Promise<void> {
  if (!isInjectableUrl(url)) {
    return;
  }

  try {
    const response = await sendMessageToTab(tabId, 'TOGGLE_EMBEDDED_MENU');
    if (response?.success !== false) {
      return;
    }
  } catch {
  }

  try {
    await sendMessageToTab(tabId, 'EXTENSION_CONFIG_UPDATED');
  } catch {
  }

  await sleep(200);

  try {
    const response = await sendMessageToTab(tabId, 'TOGGLE_EMBEDDED_MENU');
    if (response?.success !== false) {
      return;
    }
  } catch {
  }

  const injected = await ensureContentScriptInjected(tabId);
  if (!injected) {
    return;
  }

  await sleep(250);

  try {
    await sendMessageToTab(tabId, 'EXTENSION_CONFIG_UPDATED');
  } catch {
  }

  await sleep(250);

  try {
    await sendMessageToTab(tabId, 'TOGGLE_EMBEDDED_MENU');
  } catch {
  }
}

async function toggleSmartCaptureOnTab(tabId: number, url?: string): Promise<void> {
  if (!isInjectableUrl(url)) {
    return;
  }

  try {
    const response = await sendMessageToTab(tabId, 'TOGGLE_SMART_CAPTURE');
    if (response?.success) {
      return;
    }
  } catch {
  }

  try {
    await sendMessageToTab(tabId, 'EXTENSION_CONFIG_UPDATED');
  } catch {
  }

  await sleep(200);

  try {
    const response = await sendMessageToTab(tabId, 'TOGGLE_SMART_CAPTURE');
    if (response?.success) {
      return;
    }
  } catch {
  }

  const injected = await ensureContentScriptInjected(tabId);
  if (!injected) {
    return;
  }

  await sleep(250);

  try {
    await sendMessageToTab(tabId, 'EXTENSION_CONFIG_UPDATED');
  } catch {
  }

  await sleep(250);

  try {
    await sendMessageToTab(tabId, 'TOGGLE_SMART_CAPTURE');
  } catch {
  }
}

new ContextManager();
new BadgeManager();
new BookmarksManager();
const linkUrlSync = new LinkUrlSyncManager();

const cacheUserPrefs = async () => {
  try {
    const config = await getConfig();
    if (config && config.baseUrl && config.apiKey) {
      const user = await getCurrentUser(config.baseUrl, config.apiKey);
      if (user) {
        const prefs = {
          archiveAsScreenshot: user.archiveAsScreenshot ?? true,
          archiveAsMonolith: user.archiveAsMonolith ?? true,
          archiveAsPDF: user.archiveAsPDF ?? true,
          archiveAsReadable: user.archiveAsReadable ?? true,
          aiTag: (user.aiTaggingMethod !== 'DISABLED' && user.aiTaggingMethod !== undefined),
          theme: user.theme,
        };
        await chrome.storage.local.set({ 'cached_user_prefs': prefs });
      }
    }
  } catch {
  }
};

browser.runtime.onStartup.addListener(() => { cacheUserPrefs(); linkUrlSync.sync(); });
browser.runtime.onInstalled.addListener(() => { cacheUserPrefs(); linkUrlSync.sync(); });

if (browser.commands?.onCommand) {
  browser.commands.onCommand.addListener(async (command: string) => {
    if (command !== SMART_CAPTURE_COMMAND) {
      return;
    }

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return;
    }

    await toggleSmartCaptureOnTab(activeTab.id, activeTab.url);
  });
}

if (browser.action) {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await toggleEmbeddedMenuOnTab(tab.id, tab.url);
    }
  });
} else if (browser.browserAction) {
  browser.browserAction.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await toggleEmbeddedMenuOnTab(tab.id, tab.url);
    }
  });
}

browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  MessageRouter.route(message, sender, sendResponse);
  return true;
});
