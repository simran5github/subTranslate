/**
 * Storage Module
 * Handles chrome.storage.sync for settings persistence
 */

class StorageManager {
  constructor() {
    this.defaults = {
      enabled: false,
      sourceLang: 'en',
      targetLang: 'fr',
      provider: 'libretranslate',
      cacheDuration: 86400000, // 24 hours in milliseconds
      autoDetect: false,
      flickerReduction: true
    };
  }

  /**
   * Get a setting value from storage
   * @param {string|Array<string>} keys - Setting key or array of keys to retrieve
   * @returns {Promise<Object>} Object containing requested settings
   */
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, (result) => {
        // Merge with defaults for missing keys
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const merged = {};
        
        keysArray.forEach(key => {
          merged[key] = result[key] !== undefined ? result[key] : this.defaults[key];
        });
        
        resolve(merged);
      });
    });
  }

  /**
   * Get all settings
   * @returns {Promise<Object>} All settings with defaults applied
   */
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (result) => {
        const merged = { ...this.defaults, ...result };
        resolve(merged);
      });
    });
  }

  /**
   * Set a setting value in storage
   * @param {Object} items - Object with key-value pairs to store
   * @returns {Promise<void>}
   */
  async set(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove settings from storage
   * @param {string|Array<string>} keys - Setting key or array of keys to remove
   * @returns {Promise<void>}
   */
  async remove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all settings and reset to defaults
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Listen for storage changes
   * @param {Function} callback - Callback function with (changes, areaName) parameters
   * @returns {Function} Unsubscribe function
   */
  onChanged(callback) {
    const listener = (changes, areaName) => {
      if (areaName === 'sync') {
        callback(changes);
      }
    };

    chrome.storage.onChanged.addListener(listener);

    // Return unsubscribe function
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }

  /**
   * Get toggle state for extension
   * @returns {Promise<boolean>} Whether extension is enabled
   */
  async isEnabled() {
    const settings = await this.get('enabled');
    return settings.enabled;
  }

  /**
   * Set toggle state for extension
   * @param {boolean} value - Whether to enable the extension
   * @returns {Promise<void>}
   */
  async setEnabled(value) {
    return this.set({ enabled: value });
  }

  /**
   * Get current translation configuration
   * @returns {Promise<Object>} Translation settings
   */
  async getTranslationConfig() {
    return this.get(['sourceLang', 'targetLang', 'provider']);
  }

  /**
   * Update translation configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async updateTranslationConfig(config) {
    return this.set(config);
  }

  /**
   * Get default settings
   * @returns {Object} Default settings object
   */
  getDefaults() {
    return { ...this.defaults };
  }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
