/**
 * Background Service Worker
 * Handles translation requests and manages extension state
 */

// Track which tabs have content scripts active
const activeTabsMap = new Map();

/**
 * Initialize the background service worker
 */
function initializeBackground() {
  console.log('SubTranslate background script initialized');

  // Set up tab tracking
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      activeTabsMap.set(tabId, { url: tab.url, enabled: false });
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabsMap.delete(tabId);
  });
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'log') {
      console.log('[Content Script]', request.message);
      sendResponse({ received: true });
    } else if (request.action === 'translateBatch') {
      handleTranslateBatch(request.texts, request.targetLang, request.sourceLang, sendResponse);
      return true; // Indicate async response
    } else if (request.action === 'getStatus') {
      const tabId = sender.tab?.id;
      const status = activeTabsMap.get(tabId) || { url: sender.url, enabled: false };
      sendResponse(status);
    } else if (request.action === 'reportError') {
      console.error('[Content Script Error]', request.error, request.details);
      sendResponse({ received: true });
    }
  } catch (error) {
    // Suppress errors from messages arriving when handler isn't ready
    console.debug('Message handler error (non-critical):', error.message);
    sendResponse({ error: error.message });
  }
});

/**
 * Handle batch translation requests
 * @param {Array<string>} texts - Texts to translate
 * @param {string} targetLang - Target language code
 * @param {string} sourceLang - Source language code
 * @param {Function} sendResponse - Callback to send response
 */
async function handleTranslateBatch(texts, targetLang, sourceLang, sendResponse) {
  try {
    // This would integrate with a translation service
    // For now, we'll just echo back the texts
    const translations = texts.map(text => text); // Placeholder

    sendResponse({
      success: true,
      translations: translations
    });
  } catch (error) {
    console.error('Translation error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Check if content script is active on a tab
 * @param {number} tabId - Tab ID to check
 * @param {Function} callback - Callback with boolean result
 */
function isContentScriptActive(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
    // Silently handle error if content script isn't ready
    if (chrome.runtime.lastError) {
      // Content script not ready - this is normal
      callback(false);
    } else {
      callback(!!response);
    }
  });
}

/**
 * Get current extension status
 */
function getExtensionStatus() {
  return {
    version: chrome.runtime.getManifest().version,
    activeTabs: activeTabsMap.size
  };
}

// Initialize on installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('SubTranslate extension installed');
    // Open welcome page or setup guide
    chrome.tabs.create({
      url: 'popup.html'
    });
  } else if (details.reason === 'update') {
    console.log('SubTranslate extension updated');
  }
});

// Initialize background script
initializeBackground();

console.log('SubTranslate background script loaded');
