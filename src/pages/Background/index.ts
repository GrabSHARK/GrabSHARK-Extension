// import { checkLinkExists } from '../../@/lib/actions/links';
import { getCurrentUser } from '../../@/lib/actions/users';
import { getConfig } from '../../@/lib/config';
import { getBrowser } from '../../@/lib/utils';
import { BadgeManager } from './managers/BadgeManager';
import { BookmarksManager } from './managers/BookmarksManager';
import { ContextManager } from './managers/ContextManager';
import { MessageRouter } from './managers/MessageRouter';
import { OmniboxManager } from './managers/OmniboxManager';

const browser = getBrowser();



// Initialize Managers
new ContextManager();
new BadgeManager();
new OmniboxManager();
new BookmarksManager();

// Cache User Preferences on startup
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
    // Silently fail
  }
};

browser.runtime.onStartup.addListener(cacheUserPrefs);
browser.runtime.onInstalled.addListener(cacheUserPrefs);

// Toggle Embedded Menu (Extension Icon Click)
if (browser.action) {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_EMBEDDED_MENU' });
      } catch (error) {
        // Silently ignore if content script is not available (e.g., chrome:// pages)
      }
    }
  });
} else if (browser.browserAction) {
  browser.browserAction.onClicked.addListener(async (tab) => {
    if (tab.id) {
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_EMBEDDED_MENU' });
      } catch (error) {
        // Silently ignore if content script is not available (e.g., chrome:// pages)
      }
    }
  });
}

// Central Message Routing
browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  MessageRouter.route(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});
