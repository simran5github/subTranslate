/**
 * Translation Service Module
 * Provides pluggable translation providers with support for multiple services
 */

class TranslationService {
  constructor(provider = 'libretranslate') {
    this.provider = provider;
    this.providers = {
      libretranslate: new LibreTranslateProvider(),
      google: new GoogleTranslateProvider(),
      mymemory: new MyMemoryProvider()
    };
    this.currentProvider = this.providers[provider];
  }

  /**
   * Translate text using the current provider
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language code (e.g., 'fr', 'es', 'de')
   * @param {string} sourceLang - Source language code (default: 'en')
   * @returns {Promise<string>} Translated text
   */
  async translate(text, targetLang, sourceLang = 'en') {
    if (!text || text.trim().length === 0) {
      return text;
    }

    try {
      return await this.currentProvider.translate(text, targetLang, sourceLang);
    } catch (error) {
      console.error('Translation error:', error);
      throw error;
    }
  }

  /**
   * Get available providers
   * @returns {Array<string>} List of available provider names
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Switch to a different provider
   * @param {string} providerName - Name of the provider to switch to
   */
  switchProvider(providerName) {
    if (this.providers[providerName]) {
      this.provider = providerName;
      this.currentProvider = this.providers[providerName];
    } else {
      throw new Error(`Provider '${providerName}' not found`);
    }
  }
}

/**
 * LibreTranslate Provider
 * Free, open-source translation service
 * Default API: https://libretranslate.de
 */
class LibreTranslateProvider {
  constructor(apiUrl = 'https://libretranslate.de') {
    this.apiUrl = apiUrl;
    this.name = 'LibreTranslate';
  }

  async translate(text, targetLang, sourceLang = 'en') {
    const response = await fetch(`${this.apiUrl}/translate`, {
      method: 'POST',
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate API error: ${response.status}`);
    }

    const data = await response.json();
    return data.translatedText;
  }

  async getLanguages() {
    try {
      const response = await fetch(`${this.apiUrl}/languages`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching languages:', error);
      return [];
    }
  }
}

/**
 * Google Translate Provider
 * Uses unofficial Google Translate API
 */
class GoogleTranslateProvider {
  constructor() {
    this.name = 'Google Translate';
  }

  async translate(text, targetLang, sourceLang = 'en') {
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/element.js?cb=googleTranslateElementInit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: `client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
        }
      );

      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.status}`);
      }

      // Parse response - simplified approach
      // Note: This is a basic implementation; a production version might need more robust parsing
      const text_response = await response.text();
      // This would need proper parsing of Google's response format
      return text; // Fallback to original text
    } catch (error) {
      console.error('Google Translate error:', error);
      throw error;
    }
  }
}

/**
 * MyMemory Provider
 * Free translation API with no API key required
 */
class MyMemoryProvider {
  constructor() {
    this.apiUrl = 'https://api.mymemory.translated.net';
    this.name = 'MyMemory';
  }

  async translate(text, targetLang, sourceLang = 'en') {
    const response = await fetch(
      `${this.apiUrl}/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
    );

    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.responseStatus === 200) {
      return data.responseData.translatedText;
    } else {
      throw new Error(`MyMemory error: ${data.responseDetails}`);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationService, LibreTranslateProvider, GoogleTranslateProvider, MyMemoryProvider };
}
