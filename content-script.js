/**
 * Content Script
 * Runs on video pages to detect and translate subtitles
 * Uses MutationObserver to track subtitle changes
 */

// Global state
let translationService = null;
let translationCache = null;
let storageManager = null;
let subtitleDetector = null;
let extensionEnabled = false;
let currentSettings = {};
let mutationObserver = null;
let lastProcessedTexts = new Set();
let processingQueue = [];
let isProcessing = false;
let hasLoggedNoSubtitles = false;
// Track provider cooldowns (ms timestamp until which provider is paused)
const providerCooldowns = {};

/**
 * Initialize extension components
 */
async function initializeExtension() {
  try {
    console.debug('🎬 SubTranslate: Starting initialization...');
    
    // Check if utility classes are available
    if (typeof TranslationService === 'undefined') {
      throw new Error('TranslationService class not found - utils/translator.js may not be loaded');
    }
    if (typeof TranslationCache === 'undefined') {
      throw new Error('TranslationCache class not found - utils/cache.js may not be loaded');
    }
    if (typeof StorageManager === 'undefined') {
      throw new Error('StorageManager class not found - utils/storage.js may not be loaded');
    }
    if (typeof SubtitleDetector === 'undefined') {
      throw new Error('SubtitleDetector class not found - utils/subtitle-detector.js may not be loaded');
    }
    
    console.debug('✅ All utility classes loaded');
    
    // Initialize translation service
    translationService = new TranslationService('libretranslate');
    translationCache = new TranslationCache(500);
    storageManager = new StorageManager();
    subtitleDetector = new SubtitleDetector();

    console.debug('✅ Service instances created');

    // Load settings
    currentSettings = await storageManager.getAll();
    extensionEnabled = currentSettings.enabled;
    
    console.debug('✅ Settings loaded:', { enabled: extensionEnabled, targetLang: currentSettings.targetLang });

    // Set up storage change listener
    storageManager.onChanged((changes) => {
      Object.keys(changes).forEach(key => {
        currentSettings[key] = changes[key].newValue;
        
        if (key === 'enabled') {
          extensionEnabled = changes[key].newValue;
          console.debug('⚙️ Extension toggled:', extensionEnabled ? 'ON' : 'OFF');
          if (extensionEnabled) {
            startSubtitleTranslation();
          } else {
            stopSubtitleTranslation();
          }
        } else if (key === 'provider') {
          translationService.switchProvider(changes[key].newValue);
          console.debug('⚙️ Provider changed to:', changes[key].newValue);
        }
      });
    });

    if (extensionEnabled) {
      console.debug('🚀 Extension is enabled, starting translation monitoring...');
      startSubtitleTranslation();
    } else {
      console.debug('⏸️  Extension is disabled');
    }

    console.debug('🎉 SubTranslate initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing SubTranslate:', error);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Start monitoring for subtitle changes
 */
function startSubtitleTranslation() {
  console.debug('📺 Starting subtitle translation monitoring...');
  
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  // Set up MutationObserver to watch for subtitle changes
  mutationObserver = new MutationObserver((mutations) => {
    if (mutations.length > 0) {
      handleMutations();
    }
    // Debounce mutations to avoid excessive processing
    handleMutations(mutations);
  });

  const observerConfig = {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: false
  };

  // Start observing the entire document
  mutationObserver.observe(document.documentElement, observerConfig);

  console.debug('👁️  MutationObserver attached to document');

  // Initial scan for existing subtitles
  processVisibleSubtitles();

  console.debug('✅ Started monitoring for subtitle changes');
}

/**
 * Stop monitoring for subtitle changes
 */
function stopSubtitleTranslation() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  
  // Reset translated elements
  document.querySelectorAll('[data-translated="true"]').forEach(el => {
    const originalText = el.dataset.originalText || el.textContent;
    el.textContent = originalText;
    el.removeAttribute('data-translated');
    el.removeAttribute('data-translated-text');
  });

  console.debug('SubTranslate: Stopped monitoring for subtitle changes');
  hasLoggedNoSubtitles = false;
}

/**
 * Handle mutation events with debouncing
 */
let mutationTimeout = null;
function handleMutations(mutations) {
  clearTimeout(mutationTimeout);
  mutationTimeout = setTimeout(() => {
    processVisibleSubtitles();
  }, 100); // Debounce by 100ms to avoid excessive processing
}

/**
 * Process all visible subtitles on the page
 */
async function processVisibleSubtitles() {
  if (!extensionEnabled) {
    console.debug('⏸️  Extension disabled, skipping subtitle processing');
    return;
  }
  if (isProcessing) {
    console.debug('⏳ Already processing, skipping');
    return;
  }

  try {
    isProcessing = true;
    const subtitleElements = subtitleDetector.getSubtitleElements();
    if (subtitleElements.length === 0) {
      if (!hasLoggedNoSubtitles) {
        console.debug('SubTranslate: no subtitle elements detected on this page yet');
        hasLoggedNoSubtitles = true;
      }
      return;
    }

    hasLoggedNoSubtitles = false;
    
    const textsToTranslate = [];
    const elementMap = new Map();

    // Collect unique new texts to translate without modifying the visible subtitle
    for (const el of subtitleElements) {
      const text = subtitleDetector.extractText(el);
      
      if (
        text &&
        !lastProcessedTexts.has(text) &&
        !subtitleDetector.isAlreadyTranslated(el)
      ) {
        textsToTranslate.push({ text, element: el });
        elementMap.set(text, el);
        console.debug(`✨ New subtitle found: "${text}"`);
      }
    }

    // Translate new texts
    if (textsToTranslate.length > 0) {
      console.debug(`📤 Translating ${textsToTranslate.length} new subtitle(s)...`);
      await translateBatch(textsToTranslate);
    } else {
      console.debug('📭 No new subtitles to translate');
    }
  } catch (error) {
    console.error('❌ Error processing subtitles:', error);
    console.error('Stack:', error.stack);
  } finally {
    isProcessing = false;
  }
}

/**
 * Translate a batch of texts
 */
async function translateBatch(textsToTranslate) {
  const { sourceLang, targetLang } = currentSettings;
  const texts = textsToTranslate.map(item => item.text);

  console.debug(`🔤 Languages: ${sourceLang} → ${targetLang}`);

  // Check cache for already translated texts
  const { cached, missing } = translationCache.batchGet(texts, targetLang, sourceLang);
  
  if (Object.keys(cached).length > 0) {
    console.debug(`✅ ${Object.keys(cached).length} translations found in cache`);
  }

  // Apply cached translations to the tracking metadata only, without changing visible captions
  Object.entries(cached).forEach(([text, translation]) => {
    const element = textsToTranslate.find(item => item.text === text)?.element;
    if (element) {
      subtitleDetector.markAsTranslated(element, translation);
      // Mark cached texts as processed so we don't re-request them
      lastProcessedTexts.add(text);
      console.debug(`📦 Cached translation for "${text}": "${translation}"`);
    }
  });

  // Translate missing texts
  if (missing.length > 0) {
    try {
      console.debug(`🌐 Calling translation API for ${missing.length} text(s)...`);
      const translations = await translateTexts(missing, targetLang, sourceLang);
      
      // Cache and apply translations
      const translationMap = {};
      missing.forEach((text, index) => {
        const translation = translations[index];
        const element = textsToTranslate.find(item => item.text === text)?.element;

        // Only cache and mark as translated when we received a valid translation
        if (translation && translation !== text) {
          translationMap[text] = translation;
          if (element) {
            subtitleDetector.markAsTranslated(element, translation);
            lastProcessedTexts.add(text);
            console.info(`🌍 Translated: "${text}" → "${translation}"`);
          }
        } else {
          console.warn(`⚠️ Translation failed or identical for "${text}"; will retry later`);
        }
      });

      translationCache.batchSet(translationMap, targetLang, sourceLang);
      console.debug(`💾 Cached ${missing.length} translation(s)`);
    } catch (error) {
      console.error('❌ Error translating batch:', error);
    }
  }
}

/**
 * Translate multiple texts
 */
async function translateTexts(texts, targetLang, sourceLang = 'en') {
  const translations = [];

  // Helper: sleep for ms
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // Helper: translate with exponential backoff
  async function translateWithRetry(text, targetLang, sourceLang = 'en', maxAttempts = 3, baseDelay = 250) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        // If current provider is on cooldown, attempt to switch to alternative provider
        const currentProvider = translationService.provider;
        const cooldownUntil = providerCooldowns[currentProvider] || 0;
        if (cooldownUntil > Date.now()) {
          console.warn(`⏸️ Provider '${currentProvider}' is on cooldown until ${new Date(cooldownUntil).toISOString()}`);
          // Pick another available provider that is not on cooldown
          const alternatives = translationService.getAvailableProviders().filter(p => p !== currentProvider && (providerCooldowns[p] || 0) <= Date.now());
          if (alternatives.length > 0) {
            console.info(`🔁 Switching provider from '${currentProvider}' to '${alternatives[0]}'`);
            translationService.switchProvider(alternatives[0]);
          } else {
            // No alternatives, abort early
            throw new Error('No available translation providers (all on cooldown)');
          }
        }

        console.debug(`  🔄 Translating (attempt ${attempt}/${maxAttempts}) with provider '${translationService.provider}': "${text.substring(0, 50)}..."`);
        const translation = await translationService.translate(text, targetLang, sourceLang);
        if (translation && translation !== text) {
          console.debug(`  ✓ Result: "${translation.substring(0, 50)}..."`);
          return translation;
        }
        // Treat identical translation as failure to trigger retry
        throw new Error('Translation identical to source or empty');
      } catch (error) {
        console.warn(`  ✗ Attempt ${attempt} failed for "${text}": ${error.message}`);
        // If rate limited (429), put current provider on cooldown and try fallback
        const errMsg = String(error.message || '').toLowerCase();
        if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('too many requests')) {
          const providerName = translationService.provider;
          const cooldownMs = 5 * 60 * 1000; // 5 minutes
          providerCooldowns[providerName] = Date.now() + cooldownMs;
          console.warn(`🚫 Provider '${providerName}' rate-limited — pausing for ${Math.round(cooldownMs/1000)}s`);
          // Attempt to switch to another provider immediately if available
          const alternatives = translationService.getAvailableProviders().filter(p => p !== providerName && (providerCooldowns[p] || 0) <= Date.now());
          if (alternatives.length > 0) {
            try {
              translationService.switchProvider(alternatives[0]);
              console.info(`🔁 Switched provider to '${alternatives[0]}' after rate-limit`);
            } catch (swErr) {
              console.error('Provider switch failed:', swErr);
            }
          }
        }
        if (attempt >= maxAttempts) {
          console.error(`  ✖ All ${maxAttempts} attempts failed for "${text}"`);
          return null;
        }
        // Exponential backoff with small jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150);
        console.debug(`    ↻ Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
    return null;
  }

  for (const text of texts) {
    const translation = await translateWithRetry(text, targetLang, sourceLang);
    translations.push(translation);
  }

  return translations;
}


/**
 * Listen for messages from background script or popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({
      enabled: extensionEnabled,
      platform: subtitleDetector?.detectPlatform() || 'unknown',
      stats: translationCache?.getStats() || {}
    });
  } else if (request.action === 'toggleTranslation') {
    extensionEnabled = request.enabled;
    storageManager?.setEnabled(request.enabled);
    if (!subtitleDetector || !translationCache) {
      sendResponse({ success: true, pending: true });
      return;
    }
    if (request.enabled) {
      startSubtitleTranslation();
    } else {
      stopSubtitleTranslation();
    }
    sendResponse({ success: true });
  } else if (request.action === 'clearCache') {
    translationCache?.clear();
    lastProcessedTexts.clear();
    sendResponse({ success: true });
  }
});

// Initialize when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }
});

console.info('SubTranslate content script loaded');
