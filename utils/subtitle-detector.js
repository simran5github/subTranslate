/**
 * Subtitle Detector Module
 * Detects subtitle elements across different video platforms
 */

class SubtitleDetector {
  constructor() {
    // Selectors for different platforms, kept as a fallback layer.
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

    this.subtitleHints = ['subtitle', 'caption', 'timedtext', 'cue', 'cc', 'track', 'transcript'];
    this.playerHints = ['player', 'video', 'stream', 'media', 'embed', 'screen', 'content'];
    this.excludedKeywords = ['nav', 'menu', 'button', 'logo', 'icon', 'score', 'time', 'share', 'settings', 'volume', 'seek', 'progress', 'playlist', 'banner', 'cookie', 'modal', 'tooltip', 'chat', 'comment', 'loading', 'season', 'episode', 'metadata', 'description', 'overview', 'trailer', 'cast', 'director', 'genre', 'rating', 'quality', 'server', 'private', 'home', 'movies', 'series', 'cinema', 'download', 'premium', 'standard', 'free', 'source', 'sources', 'stream', 'streaming', 'playing', 'production', 'networks', 'companies', 'countries', 'languages', 'disclaimer', 'hosting'];
    this.metadataKeywords = ['season', 'episode', 'series', 'movie', 'film', 'cast', 'director', 'genre', 'rating', 'trailer', 'overview', 'description', 'loading', 'server', 'private', 'home', 'cinema', 'chapter', 'quality', 'current source', 'download', 'torrent', 'premium', 'standard', 'free', 'source', 'sources', 'stream ready', 'now playing', 'playing', 'production', 'networks', 'companies', 'countries', 'languages', 'first aired', 'important disclaimer', 'third-party content', 'no file hosting', 'powered by', 'built with', 'you may also like'];
    this.shortStopWords = new Set(['the', 'and', 'you', 'are', 'for', 'this', 'that', 'have', 'with', 'will', 'from', 'your', 'into', 'about', 'just', 'like', 'when', 'what', 'where', 'there', 'here']);
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
   * Get all subtitle elements on the page.
   * This scans player-like regions of the DOM rather than relying only on a fixed list of selectors.
   * @returns {Array<Element>} Array of subtitle DOM elements
   */
  getSubtitleElements() {
    const platform = this.detectPlatform();
    const selectorsToTry = [
      ...(this.selectors[platform] || []),
      ...this.selectors.generic
    ];

    const elements = new Set();
    const roots = this.getSearchRoots();

    roots.forEach(root => {
      this.collectSubtitleCandidates(root, elements);
    });

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
   * Build a list of likely player-related roots to scan.
   * @returns {Array<Element>} Roots to inspect
   */
  getSearchRoots() {
    const roots = [];
    const seen = new Set();

    const addRoot = (element) => {
      if (!element || seen.has(element)) return;
      seen.add(element);
      roots.push(element);
    };

    const selectors = [
      'video',
      '[role="application"]',
      '[class*="player" i]',
      '[id*="player" i]',
      '[data-testid*="player" i]',
      '[class*="video" i]',
      '[id*="video" i]',
      '[class*="stream" i]',
      '[id*="stream" i]',
      '[class*="media" i]',
      '[id*="media" i]',
      '[class*="embed" i]',
      '[id*="embed" i]'
    ];

    selectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => addRoot(el));
      } catch (error) {
        console.debug(`Invalid root selector: ${selector}`, error);
      }
    });

    if (document.body) {
      addRoot(document.body);
    }

    return roots;
  }

  /**
   * Walk a subtree and collect likely subtitle-like elements.
   * @param {Element} root - Root element to inspect
   * @param {Set<Element>} elements - Accumulator of subtitle elements
   */
  collectSubtitleCandidates(root, elements) {
    if (!root || !root.isConnected) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return NodeFilter.FILTER_REJECT;
        }

        const tagName = node.tagName.toLowerCase();
        if (['script', 'style', 'svg'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (this.isValidSubtitleElement(el)) {
        elements.add(el);
      }
    }
  }

  /**
   * Check if an element is a valid subtitle element.
   * The logic prefers elements that are visible, short, and appear inside player-like regions.
   * @param {Element} el - Element to check
   * @returns {boolean} True if element is likely a subtitle
   */
  isValidSubtitleElement(el) {
    if (!el || !el.isConnected || !el.textContent) return false;

    const text = this.extractText(el);
    if (!text || text.length < 2 || text.length > 160) return false;

    const className = (el.className || '').toString().toLowerCase();
    const id = (el.id || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    const tagName = (el.tagName || '').toLowerCase();
    const textWords = text.split(/\s+/).filter(Boolean);

    if (textWords.length > 14) return false;
    if (textWords.length < 1) return false;
    if (el.closest('button, a, input, select, textarea, [role="button"]')) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const classList = `${className} ${id} ${ariaLabel} ${role}`;
    if (this.excludedKeywords.some(keyword => classList.includes(keyword))) {
      return false;
    }

    const hasSubtitleHint = this.subtitleHints.some(keyword => classList.includes(keyword));
    const hasAncestorHint = this.hasAncestorHint(el);
    const isInsidePlayer = this.hasAncestorHint(el, this.playerHints);
    const isTextLikeElement = ['span', 'div', 'p', 'font', 'b', 'strong', 'small'].includes(tagName);
    const fontSize = parseFloat(style.fontSize) || 0;
    const isSmallText = fontSize <= 28 || textWords.length <= 8;
    const looksLikeMetadata = this.looksLikeMetadata(text, textWords, classList);

    if (looksLikeMetadata) {
      return false;
    }

    const hasCaptionCaseStructure = this.hasCaptionCaseStructure(text, textWords);
    const hasStrongTextStructure = this.hasStrongTextStructure(text, textWords);
    const isLikelySubtitle = hasSubtitleHint || hasAncestorHint || (isInsidePlayer && isTextLikeElement && isSmallText && hasStrongTextStructure);

    return isLikelySubtitle && (hasCaptionCaseStructure || hasStrongTextStructure || hasSubtitleHint || hasAncestorHint);
  }

  /**
   * Check whether text looks like metadata or UI text rather than subtitle captions.
   * @param {string} text - Extracted text
   * @param {Array<string>} textWords - Tokenized words
   * @param {string} classList - Combined element classes/ids/aria labels/role
   * @returns {boolean}
   */
  looksLikeMetadata(text, textWords, classList) {
    const normalized = text.toLowerCase();

    if (this.metadataKeywords.some(keyword => normalized.includes(keyword))) {
      return true;
    }

    if (textWords.length <= 2 && this.shortStopWords.has(textWords[0]?.toLowerCase())) {
      return true;
    }

    if (classList.includes('title') || classList.includes('episode') || classList.includes('series') || classList.includes('info')) {
      return true;
    }

    return false;
  }

  /**
   * Check for caption-like punctuation and sentence structure.
   * @param {string} text - Extracted text
   * @param {Array<string>} textWords - Tokenized words
   * @returns {boolean}
   */
  hasCaptionCaseStructure(text, textWords) {
    if (textWords.length <= 1) return false;

    const hasPunctuation = /[.!?]/.test(text);
    const hasSentenceCase = textWords.some(word => /^[A-Z]/.test(word));
    const hasMixedCase = /[a-z][A-Z]/.test(text);

    if (hasPunctuation) return true;
    if (textWords.length <= 4 && !hasSentenceCase && !hasMixedCase) return true;
    return textWords.length <= 8;
  }

  /**
   * Check whether the text has enough structure to be a real caption instead of a title/UI label.
   * @param {string} text - Extracted text
   * @param {Array<string>} textWords - Tokenized words
   * @returns {boolean}
   */
  hasStrongTextStructure(text, textWords) {
    if (textWords.length <= 1) return false;

    const hasPunctuation = /[.!?]/.test(text);
    const hasWhitespace = text.includes(' ');
    const hasSentenceCase = textWords.some(word => /^[A-Z]/.test(word));
    const hasMixedCase = /[a-z][A-Z]/.test(text);
    const hasWordLikeContent = textWords.every(word => word.length >= 2 || /\d/.test(word));

    return hasPunctuation || hasWhitespace || hasSentenceCase || hasMixedCase || hasWordLikeContent;
  }

  /**
   * Check whether an element or one of its ancestors has a matching hint.
   * @param {Element} el - Element to inspect
   * @param {Array<string>} hints - Hint keywords
   * @returns {boolean}
   */
  hasAncestorHint(el, hints = this.subtitleHints) {
    let current = el;
    while (current) {
      const className = (current.className || '').toString().toLowerCase();
      const id = (current.id || '').toLowerCase();
      const ariaLabel = (current.getAttribute('aria-label') || '').toLowerCase();
      const role = (current.getAttribute('role') || '').toLowerCase();
      const combined = `${className} ${id} ${ariaLabel} ${role}`;

      if (hints.some(keyword => combined.includes(keyword))) {
        return true;
      }

      current = current.parentElement;
    }

    return false;
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
