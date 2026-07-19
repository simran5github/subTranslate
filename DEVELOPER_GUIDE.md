# SubTranslate - Developer Guide

This guide is for developers who want to understand, extend, or contribute to SubTranslate.

## Architecture Overview

### Extension Components

```
┌─────────────────────────────────────────────────────┐
│            Brave/Chrome Browser                      │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐         ┌──────────────────┐      │
│  │ Popup UI     │         │ Background Script│      │
│  │ (popup.html) │◄────►   │ (background.js)  │      │
│  │ (popup.js)   │         │                  │      │
│  │ (popup.css)  │         │ - Tab tracking   │      │
│  └──────────────┘         │ - Message relay  │      │
│       ▲                    │ - State mgmt     │      │
│       │                    └──────────────────┘      │
│       │                                               │
│       │ chrome.storage.sync                          │
│       │ chrome.runtime.sendMessage                   │
│       │                                               │
│  ┌────┴─────────────────────────────────────────┐   │
│  │        Content Script (content-script.js)     │   │
│  │ (Injected into every video page)              │   │
│  │                                                │   │
│  │  ┌─────────────────────────────────────────┐ │   │
│  │  │ Main Translation Loop                   │ │   │
│  │  │ - MutationObserver                      │ │   │
│  │  │ - Subtitle Detection                   │ │   │
│  │  │ - Translation Processing                │ │   │
│  │  │ - DOM Updates                           │ │   │
│  │  └─────────────────────────────────────────┘ │   │
│  │                  ▲                             │   │
│  │                  │                             │   │
│  │  ┌──────────────┼──────────────────────────┐ │   │
│  │  │              │                          │ │   │
│  │  ▼              ▼                          ▼ │   │
│  │ ┌──────────┐ ┌──────────┐  ┌────────────┐ │   │
│  │ │Translator│ │  Cache   │  │ Subtitle   │ │   │
│  │ │Service   │ │ Manager  │  │ Detector   │ │   │
│  │ │          │ │          │  │            │ │   │
│  │ │- Trans   │ │- Get()   │  │- Platform  │ │   │
│  │ │- Batch   │ │- Set()   │  │  Detection │ │   │
│  │ │- Provide │ │- Stats() │  │- Element   │ │   │
│  │ │  Mgmt    │ │- LRU     │  │  Finding   │ │   │
│  │ └──────────┘ └──────────┘  │- Validation│ │   │
│  │                             └────────────┘ │   │
│  └─────────────────────────────────────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
         │                            │
         │                            │
         ▼                            ▼
    ┌─────────────┐          ┌──────────────────┐
    │  Translation │          │ External APIs    │
    │   Providers  │          │                  │
    │              │          │ - LibreTranslate │
    │ - LibreTransl│          │ - Google Transla │
    │ - Google     │          │ - MyMemory       │
    │ - MyMemory   │          └──────────────────┘
    └─────────────┘
```

## Module Breakdown

### 1. manifest.json
**Purpose**: Extension configuration and permissions

**Key Settings**:
- `manifest_version`: Always "3" for modern extensions
- `permissions`: What the extension can do
- `host_permissions`: Which websites it can access
- `content_scripts`: When/where content script runs
- `background`: Service worker configuration

**To Modify**:
- Add new permissions if adding features
- Update version when releasing updates
- Add new host_permissions for more video sites

### 2. content-script.js
**Purpose**: Core translation logic (runs on every video page)

**Main Functions**:
```javascript
initializeExtension()          // Setup on page load
startSubtitleTranslation()     // Start monitoring
stopSubtitleTranslation()      // Stop monitoring
processVisibleSubtitles()      // Find and translate subtitles
translateBatch()               // Batch translation
applyTranslation()             // Update DOM
```

**Key Mechanism - MutationObserver**:
```javascript
mutationObserver = new MutationObserver((mutations) => {
  // Called whenever DOM changes
  handleMutations(mutations);
});

mutationObserver.observe(document.documentElement, {
  childList: true,    // Watch for added/removed elements
  subtree: true,      // Watch entire DOM tree
  characterData: true // Watch text content changes
});
```

**Performance Optimization**:
- Debounces mutations (100ms delay)
- Caches processed texts to avoid re-translation
- Batch processes multiple texts
- Marks translated elements to avoid retranslation

### 3. utils/translator.js
**Purpose**: Translation service with pluggable providers

**Class: TranslationService**
```javascript
new TranslationService('libretranslate')  // Choose provider
service.translate(text, targetLang, sourceLang)
service.switchProvider('google')
service.getAvailableProviders()
```

**Adding New Providers**:
1. Create class implementing `translate()` method
2. Add to `TranslationService.providers` object
3. Update UI to include new provider option

**Example**:
```javascript
class MyProvider {
  async translate(text, targetLang, sourceLang = 'en') {
    // Make API call
    // Return translated text
  }
}
```

### 4. utils/cache.js
**Purpose**: LRU cache to avoid duplicate translations

**Key Methods**:
```javascript
cache.get(text, targetLang, sourceLang)
cache.set(text, translation, targetLang, sourceLang)
cache.batchGet(texts, targetLang, sourceLang)
cache.batchSet(translations, targetLang, sourceLang)
cache.getStats()  // Hit rate and size
cache.clear()
```

**Cache Strategy**:
- Map-based storage for O(1) lookup
- LRU eviction when max size reached
- Tracks hit/miss statistics
- Separate cache per language pair

### 5. utils/storage.js
**Purpose**: Persistent settings with chrome.storage.sync

**Key Methods**:
```javascript
storage.get(key)           // Get single setting
storage.getAll()           // Get all settings
storage.set(key, value)    // Save setting
storage.onChanged(callback) // Listen for changes
```

**Default Settings**:
```javascript
{
  enabled: false,
  sourceLang: 'en',
  targetLang: 'fr',
  provider: 'libretranslate',
  flickerReduction: true,
  autoDetect: false
}
```

### 6. utils/subtitle-detector.js
**Purpose**: Detect subtitles across different video platforms

**Platform-Specific Selectors**:
```javascript
youtube: ['.captions-text', '.ytp-caption-segment']
netflix: ['.player-timedtext', '.timedtext-span']
disneyplus: ['.subtitle-text']
// ... more platforms
```

**Key Methods**:
```javascript
detector.detectPlatform()           // Which site are we on?
detector.getSubtitleElements()      // Find all subtitle elements
detector.extractText(element)       // Get text content
detector.isValidSubtitleElement()   // Filter out non-subtitles
detector.markAsTranslated()         // Mark for tracking
detector.isAlreadyTranslated()      // Check translation status
```

### 7. popup.html / popup.js / popup.css
**Purpose**: User interface for settings

**UI Flows**:
1. Load current settings from storage
2. User changes settings
3. Save to storage
4. Notify content script of changes
5. Show status message

**Event Listeners**:
```javascript
enableToggle.addEventListener('change', handleToggleChange)
sourceLangSelect.addEventListener('change', handleSourceLangChange)
// etc.
```

### 8. background.js
**Purpose**: Extension lifecycle and message relay

**Functions**:
- `initializeBackground()` - Setup on install
- `onInstalled` listener - Show welcome on first install
- Message handling for cross-script communication

**Current Responsibilities** (could be expanded):
- Tab tracking (optional)
- Crash recovery (not yet implemented)
- Service worker lifecycle management

## Communication Flow

### Content Script ↔ Popup

**Popup sends:**
```javascript
// To current tab
chrome.tabs.sendMessage(tabId, {
  action: 'toggleTranslation',
  enabled: true
})

// Get status
chrome.tabs.sendMessage(tabId, {
  action: 'getStatus'
}, (response) => {
  console.log(response.stats)
})
```

**Content script receives:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleTranslation') {
    extensionEnabled = request.enabled
    // restart/stop monitoring
  }
})
```

### Storage Sync

**Save setting**:
```javascript
chrome.storage.sync.set({ targetLang: 'es' })
```

**Listen for changes**:
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    // Handle change
  }
})
```

## Debugging

### Enable Logging

Add to any module:
```javascript
console.log('Debug message:', variable)
console.error('Error:', error)
console.warn('Warning:', issue)
```

### View Logs

1. **Content Script**:
   - Open DevTools (F12) on video page
   - Console tab shows content script logs

2. **Service Worker**:
   - Open `brave://extensions/`
   - Click "Inspect views" under SubTranslate
   - See background script logs

3. **Popup**:
   - Right-click popup, select "Inspect"
   - View popup script logs

### Debug Translation

Add to `content-script.js`:
```javascript
// After translation
console.log('Translated:', {
  original: text,
  translated: translatedText,
  language: targetLang,
  fromCache: wasCached
})
```

## Performance Profiling

### Check Cache Effectiveness

```javascript
// In popup console
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, 
    (response) => {
      console.log('Cache stats:', response.stats)
    }
  )
})
```

### Monitor API Calls

Add to `content-script.js`:
```javascript
let apiCallCount = 0
async function translateBatch(textsToTranslate) {
  if (missing.length > 0) {
    apiCallCount++
    console.time(`Translation batch ${apiCallCount}`)
    // ... translation
    console.timeEnd(`Translation batch ${apiCallCount}`)
  }
}
```

## Testing

### Manual Testing Checklist

- [ ] Enable/disable works
- [ ] Language switching works
- [ ] Provider switching works
- [ ] Subtitles translate on YouTube
- [ ] Cache is working (check hit rate)
- [ ] Settings persist across sessions
- [ ] No console errors
- [ ] Popup opens without lag
- [ ] Multiple language pairs work
- [ ] Fast forward/rewind subtitle update works

### Testing New Providers

```javascript
// In browser console on any page
const service = new TranslationService()
service.switchProvider('mynewprovider')
service.translate('hello', 'es').then(console.log)
```

### Testing Cache

```javascript
const cache = new TranslationCache(10)
cache.set('hello', 'bonjour', 'fr', 'en')
console.log(cache.get('hello', 'fr', 'en'))  // 'bonjour'
console.log(cache.getStats())  // { hits: 1, misses: 0, ... }
```

## Common Issues & Solutions

### Issue: Subtitle Elements Not Found

**Investigation**:
1. Open DevTools on video page
2. Inspect subtitle element
3. Note the CSS classes
4. Add to `subtitle-detector.js` selectors

**Fix Example**:
```javascript
// If subtitles have class "my-subtitle"
this.selectors.generic.push('.my-subtitle')
```

### Issue: Translation Not Saving

**Check**:
1. Is storage permission in manifest.json?
2. Is chrome.storage.sync available?
3. Is error being caught silently?

**Debug**:
```javascript
// In popup.js
console.log('About to save:', key, value)
storage.set(key, value).catch(console.error)
```

### Issue: API Errors

**Check**:
1. Is API endpoint accessible?
2. Is request format correct?
3. Rate limiting issue?

**Debug**:
```javascript
// In translator.js
const response = await fetch(url, options)
console.log('Response status:', response.status)
const data = await response.json()
console.log('Response data:', data)
```

## Code Style Guidelines

### Naming Conventions

```javascript
// Classes - PascalCase
class TranslationService { }

// Functions - camelCase
function processSubtitles() { }

// Constants - UPPER_SNAKE_CASE
const MAX_CACHE_SIZE = 500

// Private variables - _underscore
let _internalState = null
```

### Comments

```javascript
/**
 * Function description
 * @param {type} name - Parameter description
 * @returns {type} Return description
 */
function myFunction(param) {
  // Complex logic explanation
}
```

### Error Handling

```javascript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  // Return fallback or re-throw
  return null
}
```

## Future Enhancement Ideas

### Easy Wins
- [ ] Context menu for quick language selection
- [ ] Keyboard shortcuts (Alt+T to toggle)
- [ ] Recently used languages in dropdown
- [ ] Cache export/import for persistence
- [ ] Dark mode for popup

### Medium Effort
- [ ] Subtitle style preservation (bold, italic)
- [ ] Per-site language preferences
- [ ] Translation quality feedback (user voting)
- [ ] Statistics dashboard
- [ ] Batch API calls optimization

### Advanced Features
- [ ] Multi-language simultaneous translation
- [ ] Custom subtitle color
- [ ] Glossary/terminology database
- [ ] Translation memory
- [ ] Machine learning quality assessment

## Release Checklist

Before publishing a new version:

- [ ] Update version in manifest.json
- [ ] Update version in package.json
- [ ] Test all features
- [ ] Run performance checks
- [ ] Update CHANGELOG.md
- [ ] Update README.md if needed
- [ ] Test on multiple platforms (YouTube, Netflix, etc.)
- [ ] Check for console errors
- [ ] Verify all selectors still work
- [ ] Get code review from team

## Contribution Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes with comments
4. Test thoroughly
5. Commit with clear messages
6. Push and create Pull Request
7. Wait for review and merge

---

**Happy coding! 🚀**

For questions, open an issue or check existing documentation.
