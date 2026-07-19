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
    // Initialize translation service
    translationService = new TranslationService('libretranslate');
    translationCache = new TranslationCache(500);
    storageManager = new StorageManager();
    subtitleDetector = new SubtitleDetector();

    // Load settings
    currentSettings = await storageManager.getAll();
    extensionEnabled = currentSettings.enabled;

    // Set up storage change listener
    storageManager.onChanged((changes) => {
      Object.keys(changes).forEach(key => {
        currentSettings[key] = changes[key].newValue;
        
        if (key === 'enabled') {
          extensionEnabled = changes[key].newValue;
          if (extensionEnabled) {
            startSubtitleTranslation();
          } else {
            stopSubtitleTranslation();
          }
        } else if (key === 'provider') {
          translationService.switchProvider(changes[key].newValue);
        }
      });
    });

    if (extensionEnabled) {
      startSubtitleTranslation();
    }

    console.log('SubTranslate initialized successfully');
  } catch (error) {
    console.error('Error initializing SubTranslate:', error);
  }
}

/**
 * Start monitoring for subtitle changes
 */
function startSubtitleTranslation() {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  // Set up MutationObserver to watch for subtitle changes
  mutationObserver = new MutationObserver((mutations) => {
    // Debounce mutations to avoid excessive processing
    handleMutations(mutations);
  });

  const observerConfig = {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: false,
    attributes: false,
    attributeFilter: []
  };

  // Start observing the entire document
  mutationObserver.observe(document.documentElement, observerConfig);

  // Initial scan for existing subtitles
  processVisibleSubtitles();

  console.log('SubTranslate: Started monitoring for subtitle changes');
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
  if (!extensionEnabled) return;
  if (isProcessing) return;

  try {
    isProcessing = true;
    const subtitleElements = subtitleDetector.getSubtitleElements();
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
      await translateBatch(textsToTranslate);
    }
  } catch (error) {
    console.error('Error processing subtitles:', error);
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

  // Check cache for already translated texts
  const { cached, missing } = translationCache.batchGet(texts, targetLang, sourceLang);

  // Apply cached translations
  Object.entries(cached).forEach(([text, translation]) => {
    const element = textsToTranslate.find(item => item.text === text)?.element;
    if (element) {
      subtitleDetector.markAsTranslated(element, translation);
      applyTranslationWithoutFlicker(element, translation);
    }
  });

  // Translate missing texts
  if (missing.length > 0) {
    try {
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
        }
      });

      translationCache.batchSet(translationMap, targetLang, sourceLang);
    } catch (error) {
      console.error('Error translating batch:', error);
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
      const translation = await translationService.translate(text, targetLang, sourceLang);
      translations.push(translation);
    } catch (error) {
      console.error(`Error translating "${text}":`, error);
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
