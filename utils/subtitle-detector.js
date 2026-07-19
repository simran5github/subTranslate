/**
 * Subtitle Detector Module
 * Detects subtitle elements across different video platforms
 */

class SubtitleDetector {
  constructor() {
    // Selectors for different platforms
    this.selectors = {
      youtube: [
        '.captions-text',
        '.ytp-caption-segment',
        'span[aria-label*="caption"]',
        '.yt-player-caption-renderer'
      ],
      netflix: [
        '.player-timedtext',
        '.timedtext-span',
        'span.timedtext-span'
      ],
      disneyplus: [
        '.subtitle-text',
        '[class*="subtitle"]',
        '[class*="text-container"]'
      ],
      primevideo: [
        '.webPlayerSubtitleText',
        'span[class*="subtitle"]',
        '[class*="subtitle-text"]'
      ],
      hulu: [
        '.closed-caption-text',
        '[class*="caption"]'
      ],
      crunchyroll: [
        '.captions-text',
        '[class*="caption"]'
      ],
      generic: [
        '.subtitle',
        '.subtitles',
        '.captions',
        '[class*="caption"]',
        '[class*="subtitle"]',
        'div[role="presentation"] > span',
        '.vjs-caption-text',
        '.vjs-text-track-cue'
      ]
    };
  }

  /**
   * Detect which platform we're on
   * @returns {string} Platform name or 'generic'
   */
  detectPlatform() {
    const url = window.location.href;
    
    if (url.includes('youtube.com')) return 'youtube';
    if (url.includes('netflix.com')) return 'netflix';
    if (url.includes('disneyplus.com')) return 'disneyplus';
    if (url.includes('primevideo.com') || url.includes('amazon.com')) return 'primevideo';
    if (url.includes('hulu.com')) return 'hulu';
    if (url.includes('crunchyroll.com')) return 'crunchyroll';
    
    return 'generic';
  }

  /**
   * Get all subtitle elements on the page
   * @returns {Array<Element>} Array of subtitle DOM elements
   */
  getSubtitleElements() {
    const platform = this.detectPlatform();
    const selectorsToTry = [
      ...(this.selectors[platform] || []),
      ...this.selectors.generic
    ];

    const elements = new Set();

    for (const selector of selectorsToTry) {
      try {
        const found = document.querySelectorAll(selector);
        found.forEach(el => {
          if (this.isValidSubtitleElement(el)) {
            elements.add(el);
          }
        });
      } catch (error) {
        // Invalid selector, skip
        console.debug(`Invalid selector: ${selector}`, error);
      }
    }

    return Array.from(elements);
  }

  /**
   * Check if an element is a valid subtitle element
   * @param {Element} el - Element to check
   * @returns {boolean} True if element is likely a subtitle
   */
  isValidSubtitleElement(el) {
    if (!el || !el.textContent) return false;

    const text = el.textContent.trim();
    
    // Filter out very small text (usually not subtitles)
    if (text.length < 2) return false;

    // Filter out common non-subtitle elements
    const classList = el.className.toLowerCase();
    const excludedKeywords = ['nav', 'menu', 'button', 'logo', 'icon', 'score', 'time'];
    if (excludedKeywords.some(keyword => classList.includes(keyword))) {
      return false;
    }

    // Check if element is visible
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    return true;
  }

  /**
   * Extract text content from subtitle element
   * @param {Element} el - Subtitle element
   * @returns {string} Extracted text
   */
  extractText(el) {
    // Clone the element to avoid modifying the DOM
    const clone = el.cloneNode(true);
    
    // Remove script tags
    clone.querySelectorAll('script').forEach(script => script.remove());
    
    // Get text content
    let text = clone.textContent.trim();
    
    // Remove extra whitespace and normalize
    text = text.replace(/\s+/g, ' ');
    
    return text;
  }

  /**
   * Find the parent subtitle container
   * @param {Element} el - Subtitle element
   * @returns {Element|null} Parent container or null
   */
  findSubtitleContainer(el) {
    let current = el;
    const maxDepth = 10;
    let depth = 0;

    while (current && depth < maxDepth) {
      const classList = current.className.toLowerCase();
      
      if (
        classList.includes('subtitle') ||
        classList.includes('caption') ||
        classList.includes('text') ||
        classList.includes('container')
      ) {
        return current;
      }

      current = current.parentElement;
      depth++;
    }

    return el;
  }

  /**
   * Check if subtitle has been recently modified
   * @param {Element} el - Subtitle element
   * @returns {boolean} True if recently modified
   */
  isRecentlyModified(el) {
    if (!el.dataset.lastModified) {
      return true;
    }

    const lastModified = parseInt(el.dataset.lastModified, 10);
    const now = Date.now();
    
    // Consider modified if changed in last 500ms
    return (now - lastModified) < 500;
  }

  /**
   * Mark element as translated
   * @param {Element} el - Element to mark
   * @param {string} translatedText - Translated text
   */
  markAsTranslated(el, translatedText) {
    el.dataset.translated = 'true';
    el.dataset.translatedText = translatedText;
    el.dataset.lastModified = Date.now().toString();
  }

  /**
   * Check if element has already been translated
   * @param {Element} el - Element to check
   * @returns {boolean} True if already translated
   */
  isAlreadyTranslated(el) {
    return el.dataset.translated === 'true';
  }

  /**
   * Get previously translated text
   * @param {Element} el - Element to check
   * @returns {string|null} Previously translated text or null
   */
  getPreviousTranslation(el) {
    return el.dataset.translatedText || null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubtitleDetector;
}
