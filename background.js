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
const AVAILABLE_PROVIDERS = ['bergamot', 'libretranslate', 'mymemory', 'google'];
const BACKGROUND_CACHE_DATA_KEY = 'backgroundTranslationCache';
const BACKGROUND_CACHE_TXT_KEY = 'backgroundTranslationCacheTxt';

const translateBatchQueue = [];
let translateBatchQueueActive = false;

function enqueueTranslateBatch(texts, targetLang, sourceLang, sendResponse, requestedProvider = null, chunkSizeOpt = null, chunkDelayOpt = null) {
  return new Promise((resolve) => {
    translateBatchQueue.push({ texts, targetLang, sourceLang, sendResponse, requestedProvider, chunkSizeOpt, chunkDelayOpt, resolve });
    if (!translateBatchQueueActive) {
      processTranslateBatchQueue();
    }
  });
}

async function processTranslateBatchQueue() {
  translateBatchQueueActive = true;
  while (translateBatchQueue.length > 0) {
    const { texts, targetLang, sourceLang, sendResponse, requestedProvider, chunkSizeOpt, chunkDelayOpt, resolve } = translateBatchQueue.shift();
    try {
      await handleTranslateBatch(texts, targetLang, sourceLang, sendResponse, requestedProvider, chunkSizeOpt, chunkDelayOpt);
    } catch (error) {
      console.error('Queued translateBatch failed:', error);
    }
    resolve();
  }
  translateBatchQueueActive = false;
}

function cacheKey(text, source, target) {
  return `${source}|${target}|${text}`;
}

function generateBackgroundCacheTxt(cacheObj) {
  return Object.entries(cacheObj).map(([key, entry]) => {
    const safeKey = encodeURIComponent(key);
    const safeValue = encodeURIComponent(String(entry?.value ?? ''));
    return `${safeKey}\t${safeValue}`;
  }).join('\n');
}

async function loadBackgroundCache() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return resolve();
    }

    chrome.storage.local.get([BACKGROUND_CACHE_DATA_KEY], (res) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to load background cache:', chrome.runtime.lastError);
        return resolve();
      }

      const stored = res[BACKGROUND_CACHE_DATA_KEY] || {};
      const now = Date.now();
      Object.entries(stored).forEach(([key, entry]) => {
        if (!entry || (entry.expires && now > entry.expires)) return;
        translationCache.set(key, entry);
      });
      resolve();
    });
  });
}

function persistBackgroundCache() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }

  const payload = {};
  translationCache.forEach((entry, key) => {
    payload[key] = entry;
  });

  chrome.storage.local.set({
    [BACKGROUND_CACHE_DATA_KEY]: payload,
    [BACKGROUND_CACHE_TXT_KEY]: generateBackgroundCacheTxt(payload)
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('Failed to persist background cache:', chrome.runtime.lastError);
    }
  });
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

function safeSendResponse(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (err) {
    console.debug('Response channel closed before sendResponse could complete:', err && err.message ? err.message : err);
  }
}

function runtimeAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function setCached(text, source, target, value, ttlMs = 24 * 60 * 60 * 1000) {
  const key = cacheKey(text, source, target);
  translationCache.set(key, { value, expires: Date.now() + ttlMs });
  persistBackgroundCache();
}

const FETCH_TIMEOUT_MS = 7000;
const TRANSLATION_PER_PROVIDER_TIMEOUT_MS = 7000;
const TRANSLATION_PER_TEXT_TIMEOUT_MS = 12000;

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function withTimeout(promise, ms, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
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

  loadBackgroundCache().then(() => {
    console.log('SubTranslate background cache loaded');
  }).catch((err) => {
    console.warn('SubTranslate background cache load failed:', err);
  });

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
      safeSendResponse(sendResponse, { received: true });
    } else if (request.action === 'translateBatch') {
      enqueueTranslateBatch(request.texts, request.targetLang, request.sourceLang, sendResponse, request.provider, request._chunkSize, request._chunkDelay);
      return true; // Indicate async response
    } else if (request.action === 'getStatus') {
      const tabId = sender.tab?.id;
      const status = activeTabsMap.get(tabId) || { url: sender.url, enabled: false };
      safeSendResponse(sendResponse, status);
    } else if (request.action === 'reportError') {
      console.error('[Content Script Error]', request.error, request.details);
      safeSendResponse(sendResponse, { received: true });
    }
  } catch (error) {
    // Suppress errors from messages arriving when handler isn't ready
    console.debug('Message handler error (non-critical):', error.message);
    safeSendResponse(sendResponse, { error: error.message });
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

      const uniqueMissing = [...new Set(missing)];
      if (uniqueMissing.length === 0) {
        const translations = cleanTexts.map(t => cachedMap[t]);
        safeSendResponse(sendResponse, { success: true, translations });
        return;
      }

      const translatedMap = {};
      for (let i = 0; i < uniqueMissing.length; i += chunkSize) {
        const chunk = uniqueMissing.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (t) => {
          try {
            const translated = await translateWithFallback(t, targetLang, sourceLang || 'en', requestedProvider);
            if (translated != null) {
              if (normalizeText(translated) !== normalizeText(t)) {
                setCached(t, sourceLang || 'en', targetLang, translated, defaults.ttlMs);
              } else {
                setCached(t, sourceLang || 'en', targetLang, t, defaults.ttlMs);
              }
            }
            return translated;
          } catch (err) {
            console.error('Translation error for text:', t, err);
            return null;
          }
        }));

        chunk.forEach((t, index) => {
          translatedMap[t] = chunkResults[index];
        });

        if (i + chunkSize < uniqueMissing.length) await new Promise(r => setTimeout(r, chunkDelay));
      }

      const final = cleanTexts.map(t => (cachedMap[t] !== undefined ? cachedMap[t] : translatedMap[t]));
      safeSendResponse(sendResponse, { success: true, translations: final });
    } catch (error) {
      console.error('Translation error:', error);
      safeSendResponse(sendResponse, { success: false, error: error.message });
    }
}

/**
 * Translate one text from the service worker, where host permissions apply.
 */
function normalizeText(text) {
  return (text || '').trim().replace(/\s+/g, ' ');
}

async function translateText(text, targetLang, sourceLang = 'en', provider = 'mymemory') {
  if (!text) return text;

  if (provider === 'bergamot') {
    try {
      const url = 'http://127.0.0.1:8888/translate';
      const resp = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: sourceLang, target: targetLang })
      });

      if (!resp.ok) {
        throw new Error(`Bergamot Translate API error: ${resp.status}`);
      }

      const data = await resp.json();
      return data.translatedText || text;
    } catch (err) {
      console.warn('Bergamot provider error:', err.message || err);
      throw err;
    }
  }

  if (provider === 'libretranslate') {
    const url = 'https://libretranslate.de/translate';
    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: 'text' })
    });

    if (!resp.ok) throw new Error(`Translation API error: ${resp.status}`);
    const data = await resp.json();
    return data.translatedText || text;
  }

  if (provider === 'google') {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetchWithTimeout(url);
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
  const response = await fetchWithTimeout(url);

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

  async function runFallbackLoop() {
    for (const provider of providers) {
      if (!isProviderAvailable(provider)) continue;
      try {
        const translated = await translateWithRetries(text, targetLang, sourceLang, provider);
        if (translated && normalizeText(translated) !== normalizeText(text)) return translated;
      } catch (err) {
        const msg = String(err && err.message || err).toLowerCase();
        if (msg.includes('429') || msg.includes('rate limit')) {
          setProviderCooldown(provider, cooldownMs);
          console.warn(`🚫 Provider '${provider}' rate-limited — pausing for ${Math.round(cooldownMs/1000)}s`);
        }
        continue;
      }
    }

    throw new Error('All translation providers failed or are rate-limited');
  }

  return await withTimeout(runFallbackLoop(), TRANSLATION_PER_TEXT_TIMEOUT_MS, `Translation timed out after ${TRANSLATION_PER_TEXT_TIMEOUT_MS}ms`);
}

async function translateWithRetries(text, targetLang, sourceLang = 'en', provider = 'mymemory', maxAttempts = 2) {
  let attempt = 0;
  const baseDelay = 150;
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
  if (!runtimeAlive()) {
    callback(false);
    return;
  }

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
