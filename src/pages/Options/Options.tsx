// Options page - redirect to grabshark.app and trigger extension
// This runs when user clicks "Extension options" from Chrome menu

(async () => {
  // Open grabshark.app in a new tab
  const tab = await chrome.tabs.create({ url: 'https://grabshark.app/' });

  // Wait for the tab to load, then trigger the extension
  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId === tab.id && info.status === 'complete') {
      // Remove this listener
      chrome.tabs.onUpdated.removeListener(listener);

      // Small delay to ensure content script is ready
      setTimeout(() => {
        // Send message to content script to show the extension overlay
        chrome.tabs.sendMessage(tab.id!, { type: 'TOGGLE_EMBEDDED_MENU' });
      }, 500);
    }
  });

  // Close this options popup/tab
  window.close();
})();
