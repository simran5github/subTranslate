/**
 * Background Service Worker
 * Handles translation requests and manages extension state
 */

// Track which tabs have content scripts active
const activeTabsMap = new Map();

// In-memory translation cache: key -> { value, expires }
const translationCache = new Map();
// Provider cooldowns: provider -> timestamp(ms) until which provider is paused
const providerCooldowns = {};
const AVAILABLE_PROVIDERS = ['libretranslate', 'mymemory', 'google'];

function cacheKey(text, source, target) {
  return `${source}|${target}|${text}`;
}

function getCached(text, source, target) {
  const key = cacheKey(text, source, target);
  const entry = translationCache.get(key);
  if (!entry) return null;
  if (entry.expires && Date.now() > entry.expires) {
    translationCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(text, source, target, value, ttlMs = 24 * 60 * 60 * 1000) {
  const key = cacheKey(text, source, target);
  translationCache.set(key, { value, expires: Date.now() + ttlMs });
}

function isProviderAvailable(provider) {
  const until = providerCooldowns[provider] || 0;
  return until <= Date.now();
}

function setProviderCooldown(provider, msFromNow) {
  providerCooldowns[provider] = Date.now() + msFromNow;
}

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

  // Note: webRequest blocking is not supported in Manifest V3 for regular extensions.
  // Subtitle file interception via blocking webRequest was removed to maintain MV3 compatibility.
  // If subtitle interception is required, consider using declarativeNetRequest or
  // performing fetch/translation from the content script instead.
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
      handleTranslateBatch(request.texts, request.targetLang, request.sourceLang, sendResponse, request.provider, request._chunkSize, request._chunkDelay);
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
async function handleTranslateBatch(texts, targetLang, sourceLang, sendResponse, requestedProvider = null, chunkSizeOpt = null, chunkDelayOpt = null) {
  (async () => {
    try {
      const chunkSize = Number.isInteger(chunkSizeOpt) ? chunkSizeOpt : 4;
      const chunkDelay = (chunkDelayOpt != null) ? chunkDelayOpt : 200;

      const cleanTexts = Array.isArray(texts) ? texts : [texts];
      // First, consult cache
      const missing = [];
      const cachedMap = {};
      const defaults = { ttlMs: 24 * 60 * 60 * 1000 };
      for (const t of cleanTexts) {
        const cached = getCached(t, sourceLang || 'en', targetLang);
        if (cached != null) cachedMap[t] = cached; else missing.push(t);
      }

      if (missing.length === 0) {
        const translations = cleanTexts.map(t => cachedMap[t]);
        sendResponse({ success: true, translations });
        return;
      }

      const results = [];
      for (let i = 0; i < missing.length; i += chunkSize) {
        const chunk = missing.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (t) => {
          try {
            const translated = await translateWithFallback(t, targetLang, sourceLang || 'en', requestedProvider);
            if (translated && translated !== t) {
              setCached(t, sourceLang || 'en', targetLang, translated, defaults.ttlMs);
            }
            return translated;
          } catch (err) {
            console.error('Translation error for text:', t, err);
            return null;
          }
        }));

        results.push(...chunkResults);
        if (i + chunkSize < missing.length) await new Promise(r => setTimeout(r, chunkDelay));
      }

      const final = cleanTexts.map(t => (cachedMap[t] !== undefined ? cachedMap[t] : results.shift()));
      sendResponse({ success: true, translations: final });
    } catch (error) {
      console.error('Translation error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
}

/**
 * Translate one text from the service worker, where host permissions apply.
 */
async function translateText(text, targetLang, sourceLang = 'en', provider = 'mymemory') {
  if (!text) return text;

  if (provider === 'libretranslate') {
    try {
      const url = 'https://libretranslate.de/translate';
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: 'text' })
      });

      if (!resp.ok) throw new Error(`Translation API error: ${resp.status}`);
      const data = await resp.json();
      // LibreTranslate returns { translatedText }
      return data.translatedText || text;
    } catch (err) {
      throw err;
    }
  }

  if (provider === 'google') {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data = await response.json();
    const translated = data?.[0]?.[0]?.[0];
    if (typeof translated === 'string' && translated.length > 0) {
      return translated;
    }

    throw new Error('Google Translate returned no translated text');
  }

  // Fallback to MyMemory
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

async function translateWithFallback(text, targetLang, sourceLang = 'en', preferredProvider = null) {
  if (sourceLang === targetLang) {
    return text;
  }

  const providers = [...AVAILABLE_PROVIDERS];
  if (preferredProvider) {
    const idx = providers.indexOf(preferredProvider);
    if (idx !== -1) {
      providers.splice(idx, 1);
      providers.unshift(preferredProvider);
    }
  }

  const settings = await new Promise((resolve) => {
    chrome.storage.sync.get(['providerCooldownMs'], (res) => resolve(res || {}));
  });
  const cooldownMs = settings.providerCooldownMs || 300000;

  for (const provider of providers) {
    if (!isProviderAvailable(provider)) continue;
    try {
      const translated = await translateWithRetries(text, targetLang, sourceLang, provider);
      if (translated && translated !== text) return translated;
    } catch (err) {
      const msg = String(err && err.message || err).toLowerCase();
      if (msg.includes('429') || msg.includes('rate limit')) {
        setProviderCooldown(provider, cooldownMs);
        console.warn(`🚫 Provider '${provider}' rate-limited — pausing for ${Math.round(cooldownMs/1000)}s`);
        continue;
      }
      continue;
    }
  }

  throw new Error('All translation providers failed or are rate-limited');
}

async function translateWithRetries(text, targetLang, sourceLang = 'en', provider = 'mymemory', maxAttempts = 3) {
  let attempt = 0;
  const baseDelay = 200;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await translateText(text, targetLang, sourceLang, provider);
    } catch (err) {
      const msg = String(err && err.message || err).toLowerCase();
      if (msg.includes('429') || msg.includes('rate limit')) {
        throw err;
      }
      if (attempt >= maxAttempts) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150);
      await new Promise(r => setTimeout(r, delay));
    }
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
