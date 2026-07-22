# SubTranslate - Real-Time Subtitle Translator

A powerful, privacy-focused Brave Browser extension that translates English subtitles to French (or any language pair) in real-time on YouTube, Netflix, Disney+, Prime Video, and other HTML5 video players.

## Features

✨ **Real-Time Translation**
- Copies subtitle text from the page DOM and translates it without altering the visible captions
- Logs translated output to the console for debugging and inspection
- Works on YouTube, Netflix, Disney+, Prime Video, Hulu, Crunchyroll, and more
- Supports multiple language pairs

🚀 **Performance**
- Smart caching system to avoid duplicate API calls
- Debounced MutationObserver for efficient subtitle detection
- Smooth transitions without flickering
- Batch translation processing

🔧 **Flexible Configuration**
- Toggle translation on/off instantly
- Choose source and target languages
- Multiple translation providers (LibreTranslate, Google, MyMemory)
- Auto-detect language option
- Flicker reduction for smooth playback

💾 **Privacy & Storage**
- Settings saved with `chrome.storage.sync`
- No data sent to external servers (except translation provider)
- Local caching of translations
- Works offline with cached translations

📊 **Developer-Friendly**
- Clean, modular ES6 code structure
- Comprehensive error handling
- Detailed logging for debugging
- Well-documented codebase
- Easy to extend with new translation providers

## Project Structure

```
subTranslate/
├── manifest.json                 # Extension manifest
├── background.js                 # Service worker for background tasks
├── content-script.js             # Runs on video pages to translate subtitles
├── popup.html                    # Popup settings UI
├── popup.js                       # Popup logic and event handlers
├── popup.css                      # Popup styling
├── utils/
│   ├── translator.js             # Translation service with pluggable providers
│   ├── cache.js                  # Translation cache management
│   ├── storage.js                # Chrome storage management
│   └── subtitle-detector.js      # Subtitle detection across platforms
├── icons/
│   ├── icon-16.png              # Extension icon (16x16)
│   ├── icon-48.png              # Extension icon (48x48)
│   └── icon-128.png             # Extension icon (128x128)
└── README.md                      # This file
```

## Installation & Setup

### Prerequisites
- Brave Browser (or Chrome/Chromium-based browsers)
- No external dependencies required

### Step 1: Prepare the Extension Folder

Clone or download this repository:

```bash
git clone https://github.com/yourusername/subTranslate.git
cd subTranslate
```

### Step 2: Create Icon Files (Optional but Recommended)

Create placeholder icon files in an `icons` folder. You can use online tools to generate them or create simple SVG icons:

```bash
mkdir -p icons
```

For a quick setup, you can add these icons manually to the `icons` folder, or comment out the icon references in `manifest.json` for now.

### Step 3: Load Extension in Brave Browser

#### Method 1: Using Brave's Extension Management UI

1. Open Brave Browser
2. Click the menu icon (⋮) in the top-right corner
3. Select **Extensions** → **Manage Extensions**
4. Enable **Developer mode** (toggle in the top-right)
5. Click **Load unpacked**
6. Navigate to the `subTranslate` folder and select it
7. The extension will appear in your extension list

#### Method 2: Direct URL

1. Open `brave://extensions/` in your address bar
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `subTranslate` folder

### Step 4: Verify Installation

1. Look for the SubTranslate icon (🎬) in your browser toolbar
2. Click it to open the settings popup
3. Navigate to a video site (YouTube, Netflix, etc.)
4. Enable translation in the popup
5. Subtitles should start translating!

## Configuration

### Popup Settings

The extension popup provides easy access to settings:

**Enable Translation** - Toggle subtitle translation on/off for the current tab

**Source Language** - Language to translate from (default: English)

**Target Language** - Language to translate to (default: French)

**Translation Provider** - Choose translation service:
- **LibreTranslate**: Free, open-source, requires internet
- **Google Translate**: Well-known service
- **MyMemory**: Free, community-driven

**Advanced Settings**:
- **Reduce Flicker**: Smooth transitions when replacing subtitles
- **Auto-Detect Language**: Automatically detect source language

### Language Options

Supported languages include:
- English, Spanish, French, German, Italian
- Portuguese, Russian, Japanese, Korean, Chinese
- Arabic, Hindi, and more

## How It Works

### Subtitle Detection

1. **Platform Detection**: Identifies which video platform you're on
2. **Element Scanning**: Finds subtitle elements using platform-specific CSS selectors
3. **Text Extraction**: Extracts and normalizes subtitle text
4. **Validation**: Filters out non-subtitle content

### Translation Process

1. **MutationObserver**: Watches the DOM for subtitle changes
2. **Debouncing**: Prevents excessive processing (100ms debounce)
3. **Cache Check**: Looks up translations in local cache first
4. **Translation**: Sends unique texts to translation service
5. **Caching**: Stores translations to avoid duplicate API calls
6. **Logging**: Emits translated output to the console while leaving the on-screen subtitles unchanged

### Performance Features

- **Smart Caching**: Up to 1000 translations cached per session
- **Batch Processing**: Groups multiple translations together
- **Debouncing**: Reduces processing with MutationObserver
- **Selective Updates**: Only translates new/changed subtitles
- **Non-Mutating Behavior**: Keeps the visible captions intact while translating in the background

## Translation Providers

### LibreTranslate (Recommended)

**Pros**: Free, open-source, works offline with local server
**Cons**: Requires internet connection to default server
**Default API**: https://libretranslate.de

To use a self-hosted LibreTranslate server, modify `utils/translator.js`:
```javascript
class LibreTranslateProvider {
  constructor(apiUrl = 'https://your-server.com') {
    this.apiUrl = apiUrl;
  }
  // ...
}
```

### Google Translate

**Pros**: High-quality translations
**Cons**: May require API key for production use

### MyMemory

**Pros**: Free, no API key required
**Cons**: Community-driven, can have varying quality

## API Reference

### Translator Service

```javascript
// Initialize translator
const service = new TranslationService('libretranslate');

// Translate single text
const translated = await service.translate('Hello', 'fr', 'en');

// Switch provider
service.switchProvider('google');

// Get available providers
const providers = service.getAvailableProviders();
```

### Translation Cache

```javascript
// Initialize cache
const cache = new TranslationCache(1000); // max 1000 items

// Get translation
const cached = cache.get('Hello', 'fr', 'en');

// Set translation
cache.set('Hello', 'Bonjour', 'fr', 'en');

// Get statistics
const stats = cache.getStats();
// Returns: { hits, misses, total, hitRate, cacheSize, maxSize }

// Clear cache
cache.clear();
```

### Storage Manager

```javascript
// Initialize storage
const storage = new StorageManager();

// Get setting
const enabled = await storage.isEnabled();

// Set setting
await storage.setEnabled(true);

// Get translation config
const config = await storage.getTranslationConfig();

// Listen for changes
const unsubscribe = storage.onChanged((changes) => {
  console.log('Settings changed:', changes);
});

// Unsubscribe
unsubscribe();
```

### Subtitle Detector

```javascript
// Initialize detector
const detector = new SubtitleDetector();

// Detect platform
const platform = detector.detectPlatform();

// Get all subtitle elements
const elements = detector.getSubtitleElements();

// Extract text from element
const text = detector.extractText(element);

// Mark element as translated
detector.markAsTranslated(element, translatedText);

// Check if already translated
const isTranslated = detector.isAlreadyTranslated(element);
```

## Customization

### Adding a New Translation Provider

1. Create a new provider class in `utils/translator.js`:

```javascript
class MyCustomProvider {
  constructor() {
    this.name = 'My Custom Service';
  }

  async translate(text, targetLang, sourceLang = 'en') {
    // Implement translation logic
    const response = await fetch('https://api.example.com/translate', {
      method: 'POST',
      body: JSON.stringify({ text, targetLang, sourceLang })
    });
    const data = await response.json();
    return data.translatedText;
  }
}
```

2. Register in `TranslationService`:

```javascript
this.providers = {
  libretranslate: new LibreTranslateProvider(),
  google: new GoogleTranslateProvider(),
  mymemory: new MyMemoryProvider(),
  custom: new MyCustomProvider()  // Add here
};
```

3. Add to popup select options in `popup.html`

### Adjusting Cache Size

Edit in `content-script.js`:
```javascript
translationCache = new TranslationCache(500); // Change max size
```

### Changing Default Language

Edit in `utils/storage.js`:
```javascript
this.defaults = {
  targetLang: 'es', // Changed from 'fr' to 'es' for Spanish
  // ...
};
```

### Adding New Platforms

Edit CSS selectors in `utils/subtitle-detector.js`:
```javascript
this.selectors = {
  newplatform: [
    '.subtitle-selector-1',
    '.subtitle-selector-2'
  ]
  // ...
};
```

## Troubleshooting

### Subtitles Not Translating

1. **Check if enabled**: Click the extension icon and verify translation is enabled
2. **Check browser console**: Open DevTools (F12) → Console for error messages
3. **Verify subtitles appear**: Make sure subtitles are actually displayed
4. **Try clearing cache**: Click "Clear Cache" in the popup

### Poor Translation Quality

- Switch translation provider (try MyMemory or Google)
- Check source language is correct
- Verify target language is selected

### API Rate Limiting

If you see translation errors:
- The translation service might be rate limiting
- Try clearing the cache to start fresh
- Consider using a self-hosted LibreTranslate server

### Extension Not Working on Specific Site

1. Check if the site uses HTML5 video
2. Report the site in issues
3. Add custom selectors for that site in `subtitle-detector.js`

### High Memory Usage

- Reduce cache size in `content-script.js`
- Close unused browser tabs
- Disable flicker reduction if needed

## Performance Tips

1. **Use LibreTranslate locally**: Deploy LibreTranslate server and use local URL
2. **Reduce cache size**: Balance memory vs. duplicate API calls
3. **Selective platforms**: Only enable on platforms you use
4. **Disable auto-detect**: If not needed, saves processing
5. **Close unused tabs**: Each tab runs the extension independently

## Security & Privacy

- ✅ No data stored on remote servers (except translation requests)
- ✅ All settings stored locally with `chrome.storage.sync`
- ✅ No analytics or tracking
- ✅ Content scripts only run on video platforms
- ✅ No third-party scripts or libraries

**Note**: Translation text is sent to the selected translation provider. Choose a provider you trust.

## Development

### Console Logging

The extension logs useful debugging information:
```
SubTranslate: Started monitoring for subtitle changes
Cache stats: { hits: 42, misses: 15, hitRate: '73.68%' }
```

### Debugging with DevTools

1. Open extension details page
2. Click "Inspect views" → "service worker"
3. View console logs and messages
4. Set breakpoints in source code

### Code Structure

- **content-script.js**: Main translation logic and DOM manipulation
- **background.js**: Event handling and tab management
- **popup.js**: UI interactions and settings
- **utils/**: Modular utilities for translation, caching, storage, detection

## Known Limitations

- Only works on HTML5 video players (not Flash)
- May not work on sites with special DRM protections
- Translation quality depends on selected provider
- Some sites may have custom subtitle implementations not detected
- Subtitles with special formatting may lose styling

## Contributing

Contributions are welcome! Areas for improvement:

- Additional translation providers
- Better platform detection
- Performance optimizations
- UI/UX improvements
- Icon/branding assets
- Bug fixes and testing

## License

MIT License - Feel free to use, modify, and distribute

## Credits

- **LibreTranslate**: Free translation API
- **MyMemory**: Translation service
- Icons: Custom or CC0 licensed

## Support & Feedback

- 🐛 Found a bug? Report it!
- 💡 Have a feature idea? Let me know!
- ⭐ Enjoying the extension? Give it a star!

---

**Happy translating! 🎬🌍**

SubTranslate v1.0.0 - Real-time subtitle translation for a borderless web