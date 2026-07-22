/**
 * Background Service Worker
 * Handles translation requests and manages extension state
 */

importScripts('utils/subtitle-file-handler.js');

// Track which tabs have content scripts active
const activeTabsMap = new Map();
const subtitleFileHandler = new SubtitleFileHandler(null);

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

  chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
      const detection = detectSubtitleResource(details.url);
      if (!detection.isSubtitle) {
        return {};
      }

      try {
        const handler = new SubtitleFileHandler({
          translate: async (text, targetLang, sourceLang = 'en') => {
            return translateText(text, targetLang, sourceLang);
          }
        });

        const result = await handler.handleSubtitleRequest(details);
        if (result?.body) {
          return { redirectUrl: 'data:text/plain;charset=utf-8,' + encodeURIComponent(result.body) };
        }
      } catch (error) {
        console.debug('Subtitle interception failed:', error);
      }

      return {};
    },
    { urls: ['<all_urls>'] },
    ['blocking']
  );
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
    const translations = await Promise.all(
      texts.map(text => translateText(text, targetLang, sourceLang))
    );

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
 * Translate one text from the service worker, where host permissions apply.
 */
async function translateText(text, targetLang, sourceLang = 'en') {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Translation API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(`Translation service unavailable: ${data.responseDetails || 'unknown error'}`);
  }

  return data.responseData.translatedText;
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
