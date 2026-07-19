/**
 * Popup Script
 * Handles the popup UI interactions and settings management
 */

// DOM Elements
const enableToggle = document.getElementById('enableToggle');
const sourceLangSelect = document.getElementById('sourceLang');
const targetLangSelect = document.getElementById('targetLang');
const providerSelect = document.getElementById('provider');
const flickerReductionToggle = document.getElementById('flickerReduction');
const autoDetectToggle = document.getElementById('autoDetect');
const clearCacheBtn = document.getElementById('clearCacheBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const statusMessage = document.getElementById('statusMessage');
const cacheStatsDiv = document.getElementById('cacheStats');

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

/**
 * Initialize popup UI
 */
async function initializePopup() {
  try {
    // Load current settings
    await loadSettings();

    // Set up event listeners
    enableToggle.addEventListener('change', handleToggleChange);
    sourceLangSelect.addEventListener('change', handleSourceLangChange);
    targetLangSelect.addEventListener('change', handleTargetLangChange);
    providerSelect.addEventListener('change', handleProviderChange);
    flickerReductionToggle.addEventListener('change', handleFlickerReductionChange);
    autoDetectToggle.addEventListener('change', handleAutoDetectChange);
    clearCacheBtn.addEventListener('click', handleClearCache);
    resetSettingsBtn.addEventListener('click', handleResetSettings);

    // Update cache stats periodically
    updateCacheStats();
    setInterval(updateCacheStats, 2000);

    console.log('Popup initialized successfully');
  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Error initializing popup', 'error');
  }
}

/**
 * Load current settings and update UI
 */
async function loadSettings() {
  try {
    const storageManager = new StorageManager();
    const settings = await storageManager.getAll();

    // Update toggle states
    enableToggle.checked = settings.enabled;
    flickerReductionToggle.checked = settings.flickerReduction;
    autoDetectToggle.checked = settings.autoDetect;

    // Update select values
    sourceLangSelect.value = settings.sourceLang || 'en';
    targetLangSelect.value = settings.targetLang || 'fr';
    providerSelect.value = settings.provider || 'libretranslate';

    console.log('Settings loaded:', settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

/**
 * Save a setting
 */
async function saveSetting(key, value) {
  try {
    const storageManager = new StorageManager();
    await storageManager.set({ [key]: value });
    console.log(`Setting saved: ${key} = ${value}`);
  } catch (error) {
    console.error('Error saving setting:', error);
    showStatus('Error saving setting', 'error');
  }
}

/**
 * Handle toggle change
 */
async function handleToggleChange(event) {
  const enabled = event.target.checked;
  await saveSetting('enabled', enabled);

  // Notify content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, {
      action: 'toggleTranslation',
      enabled: enabled
    });
  } catch (error) {
    console.error('Error sending message to content script:', error);
  }

  showStatus(
    enabled ? 'Translation enabled' : 'Translation disabled',
    'info'
  );
}

/**
 * Handle source language change
 */
async function handleSourceLangChange(event) {
  const sourceLang = event.target.value;
  await saveSetting('sourceLang', sourceLang);
  showStatus('Source language updated', 'info');
}

/**
 * Handle target language change
 */
async function handleTargetLangChange(event) {
  const targetLang = event.target.value;
  await saveSetting('targetLang', targetLang);
  showStatus('Target language updated', 'info');
}

/**
 * Handle provider change
 */
async function handleProviderChange(event) {
  const provider = event.target.value;
  await saveSetting('provider', provider);
  showStatus('Translation provider updated', 'info');

  // Notify content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, {
      action: 'updateProvider',
      provider: provider
    });
  } catch (error) {
    console.error('Error sending message to content script:', error);
  }
}

/**
 * Handle flicker reduction toggle
 */
async function handleFlickerReductionChange(event) {
  const flickerReduction = event.target.checked;
  await saveSetting('flickerReduction', flickerReduction);
  showStatus(
    flickerReduction ? 'Flicker reduction enabled' : 'Flicker reduction disabled',
    'info'
  );
}

/**
 * Handle auto-detect toggle
 */
async function handleAutoDetectChange(event) {
  const autoDetect = event.target.checked;
  await saveSetting('autoDetect', autoDetect);
  showStatus(
    autoDetect ? 'Auto-detection enabled' : 'Auto-detection disabled',
    'info'
  );
}

/**
 * Handle clear cache
 */
async function handleClearCache() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'clearCache' });
    showStatus('Cache cleared successfully', 'success');
  } catch (error) {
    console.error('Error clearing cache:', error);
    showStatus('Error clearing cache', 'error');
  }
}

/**
 * Handle reset settings
 */
async function handleResetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    try {
      const storageManager = new StorageManager();
      const defaults = storageManager.getDefaults();
      
      await storageManager.clear();
      await storageManager.set(defaults);
      
      // Reload UI
      await loadSettings();
      
      showStatus('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Error resetting settings:', error);
      showStatus('Error resetting settings', 'error');
    }
  }
}

/**
 * Update cache statistics from content script
 */
async function updateCacheStats() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (response && response.stats) {
        document.getElementById('cacheHits').textContent = response.stats.hits || 0;
        document.getElementById('cacheMisses').textContent = response.stats.misses || 0;
        document.getElementById('hitRate').textContent = response.stats.hitRate || '0%';
        document.getElementById('cacheSize').textContent = `${response.stats.cacheSize || 0} / ${response.stats.maxSize || 500}`;
      }
    });
  } catch (error) {
    // Tab might not have content script active - this is expected
    console.debug('Could not get cache stats:', error);
  }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}

/**
 * Get current active tab language preferences
 */
async function getTabLanguages() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getLanguages'
    });
    return response;
  } catch (error) {
    console.error('Error getting tab languages:', error);
    return null;
  }
}

console.log('Popup script loaded');
