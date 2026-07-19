/**
 * Translation Cache Module
 * Caches translations to avoid duplicate API calls and improve performance
 */

class TranslationCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Generate a cache key from translation parameters
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language
   * @param {string} sourceLang - Source language
   * @returns {string} Cache key
   */
  generateKey(text, targetLang, sourceLang = 'en') {
    return `${sourceLang}:${targetLang}:${text}`;
  }

  /**
   * Get cached translation
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language
   * @param {string} sourceLang - Source language
   * @returns {string|null} Cached translation or null if not found
   */
  get(text, targetLang, sourceLang = 'en') {
    const key = this.generateKey(text, targetLang, sourceLang);
    if (this.cache.has(key)) {
      this.hits++;
      return this.cache.get(key);
    }
    this.misses++;
    return null;
  }

  /**
   * Set translation in cache
   * @param {string} text - Original text
   * @param {string} translation - Translated text
   * @param {string} targetLang - Target language
   * @param {string} sourceLang - Source language
   */
  set(text, translation, targetLang, sourceLang = 'en') {
    const key = this.generateKey(text, targetLang, sourceLang);
    
    // Implement simple LRU eviction if cache exceeds max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, translation);
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache hit/miss statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      total: total,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Get cache size
   * @returns {number} Number of items in cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Batch get multiple translations from cache
   * @param {Array<string>} texts - Array of texts to look up
   * @param {string} targetLang - Target language
   * @param {string} sourceLang - Source language
   * @returns {Object} Object with cached texts and missing texts
   */
  batchGet(texts, targetLang, sourceLang = 'en') {
    const cached = {};
    const missing = [];

    texts.forEach(text => {
      const translation = this.get(text, targetLang, sourceLang);
      if (translation) {
        cached[text] = translation;
      } else {
        missing.push(text);
      }
    });

    return { cached, missing };
  }

  /**
   * Batch set multiple translations in cache
   * @param {Object} translations - Object with text as key and translation as value
   * @param {string} targetLang - Target language
   * @param {string} sourceLang - Source language
   */
  batchSet(translations, targetLang, sourceLang = 'en') {
    Object.entries(translations).forEach(([text, translation]) => {
      this.set(text, translation, targetLang, sourceLang);
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationCache;
}
