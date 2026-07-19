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

/**
 * Initialize extension components
 */
async function initializeExtension() {
  try {
    console.log('🎬 SubTranslate: Starting initialization...');
    
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
    
    console.log('✅ All utility classes loaded');
    
    // Initialize translation service
    translationService = new TranslationService('libretranslate');
    translationCache = new TranslationCache(500);
    storageManager = new StorageManager();
    subtitleDetector = new SubtitleDetector();

    console.log('✅ Service instances created');

    // Load settings
    currentSettings = await storageManager.getAll();
    extensionEnabled = currentSettings.enabled;
    
    console.log('✅ Settings loaded:', { enabled: extensionEnabled, targetLang: currentSettings.targetLang });

    // Set up storage change listener
    storageManager.onChanged((changes) => {
      Object.keys(changes).forEach(key => {
        currentSettings[key] = changes[key].newValue;
        
        if (key === 'enabled') {
          extensionEnabled = changes[key].newValue;
          console.log('⚙️ Extension toggled:', extensionEnabled ? 'ON' : 'OFF');
          if (extensionEnabled) {
            startSubtitleTranslation();
          } else {
            stopSubtitleTranslation();
          }
        } else if (key === 'provider') {
          translationService.switchProvider(changes[key].newValue);
          console.log('⚙️ Provider changed to:', changes[key].newValue);
        }
      });
    });

    if (extensionEnabled) {
      console.log('🚀 Extension is enabled, starting translation monitoring...');
      startSubtitleTranslation();
    } else {
      console.log('⏸️  Extension is disabled');
    }

    console.log('🎉 SubTranslate initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing SubTranslate:', error);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Start monitoring for subtitle changes
 */
function startSubtitleTranslation() {
  console.log('📺 Starting subtitle translation monitoring...');
  
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  // Set up MutationObserver to watch for subtitle changes
  mutationObserver = new MutationObserver((mutations) => {
    console.log(`🔄 Detected ${mutations.length} DOM mutations`);
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

  console.log('👁️  MutationObserver attached to document');

  // Initial scan for existing subtitles
  processVisibleSubtitles();

  console.log('✅ Started monitoring for subtitle changes');
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

  console.log('SubTranslate: Stopped monitoring for subtitle changes');
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
    console.log('⏸️  Extension disabled, skipping subtitle processing');
    return;
  }
  if (isProcessing) {
    console.log('⏳ Already processing, skipping');
    return;
  }

  try {
    isProcessing = true;
    const subtitleElements = subtitleDetector.getSubtitleElements();
    console.log(`🔍 Found ${subtitleElements.length} subtitle elements`);
    
    const textsToTranslate = [];
    const elementMap = new Map();

    // Collect unique new texts to translate
    for (const el of subtitleElements) {
      const text = subtitleDetector.extractText(el);
      
      if (
        text &&
        !lastProcessedTexts.has(text) &&
        !subtitleDetector.isAlreadyTranslated(el)
      ) {
        textsToTranslate.push({ text, element: el });
        elementMap.set(text, el);
        lastProcessedTexts.add(text);
        console.log(`✨ New subtitle found: "${text}"`);
      } else if (subtitleDetector.isAlreadyTranslated(el)) {
        // Verify translated content is still correct
        const translatedText = subtitleDetector.getPreviousTranslation(el);
        if (translatedText && el.textContent !== translatedText) {
          applyTranslation(el, translatedText);
        }
      }
    }

    // Translate new texts
    if (textsToTranslate.length > 0) {
      console.log(`📤 Translating ${textsToTranslate.length} new subtitle(s)...`);
      await translateBatch(textsToTranslate);
    } else {
      console.log('📭 No new subtitles to translate');
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

  console.log(`🔤 Languages: ${sourceLang} → ${targetLang}`);

  // Check cache for already translated texts
  const { cached, missing } = translationCache.batchGet(texts, targetLang, sourceLang);
  
  if (Object.keys(cached).length > 0) {
    console.log(`✅ ${Object.keys(cached).length} translations found in cache`);
  }

  // Apply cached translations
  Object.entries(cached).forEach(([text, translation]) => {
    const element = textsToTranslate.find(item => item.text === text)?.element;
    if (element) {
      subtitleDetector.markAsTranslated(element, translation);
      applyTranslationWithoutFlicker(element, translation);
      console.log(`📦 Applied cached: "${text}" → "${translation}"`);
    }
  });

  // Translate missing texts
  if (missing.length > 0) {
    try {
      console.log(`🌐 Calling translation API for ${missing.length} text(s)...`);
      const translations = await translateTexts(missing, targetLang, sourceLang);
      
      // Cache and apply translations
      const translationMap = {};
      missing.forEach((text, index) => {
        const translation = translations[index];
        translationMap[text] = translation;
        
        const element = textsToTranslate.find(item => item.text === text)?.element;
        if (element) {
          subtitleDetector.markAsTranslated(element, translation);
          applyTranslationWithoutFlicker(element, translation);
          console.log(`🌍 Translated: "${text}" → "${translation}"`);
        }
      });

      translationCache.batchSet(translationMap, targetLang, sourceLang);
      console.log(`💾 Cached ${missing.length} translation(s)`);
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

  for (const text of texts) {
    try {
      console.log(`  🔄 Translating: "${text.substring(0, 50)}..."`);
      const translation = await translationService.translate(text, targetLang, sourceLang);
      translations.push(translation);
      console.log(`  ✓ Result: "${translation.substring(0, 50)}..."`);
    } catch (error) {
      console.error(`  ✗ Error translating "${text}":`, error);
      translations.push(text); // Fallback to original text
    }
  }

  return translations;
}

/**
 * Apply translation to element without flickering
 * Uses opacity transitions to avoid visual flicker
 */
function applyTranslationWithoutFlicker(element, translatedText) {
  if (!element) return;

  // Store original text for restoration
  if (!element.dataset.originalText) {
    element.dataset.originalText = element.textContent;
  }

  // Use requestAnimationFrame for smooth transition
  requestAnimationFrame(() => {
    // Reduce opacity for transition
    element.style.transition = 'opacity 0.1s ease-in-out';
    element.style.opacity = '0.7';

    requestAnimationFrame(() => {
      // Update text
      element.textContent = translatedText;
      element.style.opacity = '1';

      // Clean up transition after completion
      setTimeout(() => {
        element.style.transition = '';
      }, 150);
    });
  });
}

/**
 * Apply translation directly (used for cached translations)
 */
function applyTranslation(element, translatedText) {
  if (!element) return;

  // Store original text for restoration
  if (!element.dataset.originalText) {
    element.dataset.originalText = element.textContent;
  }

  element.textContent = translatedText;
}

/**
 * Listen for messages from background script or popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({
      enabled: extensionEnabled,
      platform: subtitleDetector.detectPlatform(),
      stats: translationCache?.getStats() || {}
    });
  } else if (request.action === 'toggleTranslation') {
    extensionEnabled = request.enabled;
    storageManager.setEnabled(request.enabled);
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

console.log('SubTranslate content script loaded');
