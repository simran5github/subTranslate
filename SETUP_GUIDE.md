# SubTranslate - Complete Setup Guide

## Quick Start (5 minutes)

### Prerequisites
- Brave Browser installed (or Chrome/Chromium-based browser)
- This extension folder

### Step-by-Step Installation

#### 1. Prepare the Extension Folder

```bash
# Navigate to the subTranslate directory
cd /path/to/subTranslate

# Verify all required files exist
ls -la

# Expected files:
# - manifest.json
# - content-script.js
# - background.js
# - popup.html
# - popup.js
# - popup.css
# - utils/translator.js
# - utils/cache.js
# - utils/storage.js
# - utils/subtitle-detector.js
```

#### 2. Create Icons (Optional)

The extension will work without icons, but they look better with them.

**Option A: Using the setup script (Linux/Mac)**
```bash
chmod +x setup-icons.sh
./setup-icons.sh
```

**Option B: Manual icon creation**
- Create an `icons` folder in the extension directory
- Add PNG files: `icon-16.png`, `icon-48.png`, `icon-128.png`
- Or use an online tool to convert the SVG provided in setup-icons.sh

**Option C: Skip icons for now**
- The extension will work without icons
- You can add them later

#### 3. Load in Brave Browser

**Method 1: Brave Menu**
1. Open Brave Browser
2. Click the menu icon (≡) in the top-right corner
3. Go to **Extensions** → **Manage Extensions**
4. Toggle **Developer mode** ON (bottom-right corner)
5. Click the **Load unpacked** button
6. Navigate to your `subTranslate` folder
7. Click **Select Folder**

**Method 2: Direct URL**
1. Type `brave://extensions/` in the address bar
2. Toggle **Developer mode** ON (top-right)
3. Click **Load unpacked**
4. Select the `subTranslate` folder
5. Click **Open**

#### 4. Verify Installation

1. Look for the SubTranslate icon in your toolbar (or check the extensions menu)
2. Click the extension icon to open the popup
3. You should see the settings interface with:
   - Toggle switch for enabling/disabling
   - Language selection dropdowns
   - Translation provider options

#### 5. Test on a Video Site

1. Go to **YouTube.com** (or any supported video site)
2. Find a video with subtitles
3. Enable subtitles (CC icon in video player)
4. Click the SubTranslate extension icon
5. Toggle **Enable Translation** ON
6. Make sure source and target languages are set correctly
7. Watch the subtitles translate in real-time!

## Supported Video Platforms

The extension works on these platforms (and many more):
- ✅ YouTube
- ✅ Netflix
- ✅ Disney+
- ✅ Amazon Prime Video
- ✅ Hulu
- ✅ Crunchyroll
- ✅ Hotstar
- ✅ Any site with HTML5 video player and captions

## Configuration

### Basic Settings

**Enable/Disable Translation**
- Use the toggle in the popup to turn translation on/off
- Settings are saved automatically
- Works per-tab

**Choose Languages**
- Source Language: The language to translate FROM (default: English)
- Target Language: The language to translate TO (default: French)

**Select Translation Provider**
- **LibreTranslate** (Recommended)
  - Free and open-source
  - No API key required
  - Works best with default settings
  
- **Google Translate**
  - High-quality translations
  - May require API key
  
- **MyMemory**
  - Free service
  - Community-driven translations

### Advanced Settings

**Reduce Flicker**
- Creates smooth opacity transitions when changing subtitles
- Helps maintain visual comfort
- Slight performance cost

**Auto-Detect Language**
- Automatically detects the source language
- Useful when subtitles are in different languages
- May slow down processing slightly

## Troubleshooting

### Issue: Extension Icon Not Showing

**Solution:**
1. Open `brave://extensions/`
2. Find "SubTranslate" in the list
3. Check that it's enabled (toggle should be ON)
4. Pin it to the toolbar (click the pin icon)

### Issue: Subtitles Not Translating

**Checklist:**
1. Is the extension enabled? Click the icon and check the toggle
2. Are subtitles actually showing? Enable CC in video player
3. Check browser console for errors:
   - Press F12 to open DevTools
   - Go to the Console tab
   - Look for any red error messages
4. Try clearing the cache:
   - Click extension icon → "Clear Cache" button
5. Refresh the page (Ctrl+R or Cmd+R)

### Issue: Poor Translation Quality

**Solution:**
1. Verify source language is correct (should usually be "English")
2. Try switching to a different translation provider:
   - Settings popup → Translation Provider dropdown
3. Check that target language is set correctly
4. Try translating in the opposite direction to test
5. Some providers have better quality than others

### Issue: "API Error" Messages

**Solutions:**
1. Check your internet connection
2. Try a different translation provider
3. If using LibreTranslate:
   - The default public server may be rate-limited
   - Either wait a few minutes or switch providers
   - Consider using a self-hosted LibreTranslate server

### Issue: Extension Crashes or Stops Working

**Steps to fix:**
1. Click extension icon → "Clear Cache"
2. Refresh the webpage (Ctrl+R)
3. Disable and re-enable the extension
4. Restart your browser
5. Reload the extension:
   - Open `brave://extensions/`
   - Click the reload icon on SubTranslate

### Issue: High Memory Usage

**Reduce resource consumption:**
1. Close unused browser tabs (each tab runs the extension)
2. Click extension → "Clear Cache"
3. Disable "Reduce Flicker" if not needed
4. Reduce cache size in `content-script.js` (advanced)

## Using Self-Hosted LibreTranslate

For production or to avoid rate-limiting:

### 1. Install LibreTranslate Server

```bash
# Using Docker (recommended)
docker run -d -p 5000:5000 libretranslate/libretranslate

# Or using Python
pip install libretranslate
libretranslate --port 5000
```

### 2. Update Extension Configuration

Edit `utils/translator.js`:

```javascript
class LibreTranslateProvider {
  constructor(apiUrl = 'http://localhost:5000') {  // Change this line
    this.apiUrl = apiUrl;
    this.name = 'LibreTranslate';
  }
  // ... rest of code
}
```

### 3. Reload Extension

1. Open `brave://extensions/`
2. Click the reload icon on SubTranslate
3. Test on YouTube or other video site

## Advanced Customization

### Adding a Custom Translation Provider

Edit `utils/translator.js`:

```javascript
// Add your provider class
class YourProviderName {
  constructor(apiUrl = 'https://api.example.com') {
    this.apiUrl = apiUrl;
    this.name = 'Your Provider Name';
  }

  async translate(text, targetLang, sourceLang = 'en') {
    const response = await fetch(`${this.apiUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang })
    });
    const data = await response.json();
    return data.translatedText;
  }
}

// Register it in TranslationService constructor:
this.providers = {
  libretranslate: new LibreTranslateProvider(),
  yourprovider: new YourProviderName()  // Add this line
};
```

### Adding Support for a New Video Platform

Edit `utils/subtitle-detector.js`:

```javascript
// Add platform detection
detectPlatform() {
  const url = window.location.href;
  if (url.includes('yoursite.com')) return 'yoursite';
  // ... existing code
}

// Add CSS selectors for subtitle elements
this.selectors = {
  yoursite: [
    '.subtitle-class-1',
    '.subtitle-class-2',
    '[data-subtitle="true"]'
  ],
  // ... existing selectors
};
```

### Changing Default Settings

Edit `utils/storage.js`:

```javascript
this.defaults = {
  enabled: false,
  sourceLang: 'en',       // Change source language
  targetLang: 'fr',       // Change target language
  provider: 'libretranslate',
  cacheDuration: 86400000, // 24 hours in milliseconds
  autoDetect: false,
  flickerReduction: true
};
```

## File Structure Explained

```
subTranslate/
├── manifest.json
│   └── Extension configuration and permissions
│
├── background.js
│   └── Handles extension lifecycle and tab management
│
├── content-script.js
│   └── Main logic: MutationObserver, translation, DOM updates
│
├── popup.html
│   └── User interface for settings
│
├── popup.js
│   └── Popup interactions and storage sync
│
├── popup.css
│   └── Beautiful styling for the popup
│
├── utils/
│   ├── translator.js       - Translation service with multiple providers
│   ├── cache.js            - Smart caching system
│   ├── storage.js          - Chrome storage management
│   └── subtitle-detector.js - Platform detection and element finding
│
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
│
└── README.md
    └── Full documentation
```

## Key Features Explained

### MutationObserver
- Watches the DOM for any changes to subtitle elements
- Automatically detects when new subtitles appear
- Debounced to avoid excessive processing (100ms)

### Smart Cache
- Stores up to 500 translations by default
- Avoids duplicate API calls
- Shows cache hit rate in the popup
- Can be cleared manually

### Flicker Reduction
- Uses opacity transitions instead of instant text replacement
- Creates smooth visual experience
- Can be disabled if not needed

### Platform Support
- Detects 6+ major platforms automatically
- Uses platform-specific CSS selectors
- Falls back to generic selectors as backup
- Easy to add support for new sites

## Getting Help

### Check the Console
Open DevTools (F12) and look at the Console tab:
- Error messages show what went wrong
- Debug logs show extension activity
- Stack traces help identify issues

### Common Console Messages

Good (normal operation):
```
SubTranslate initialized successfully
SubTranslate: Started monitoring for subtitle changes
Settings loaded: {...}
```

Warning (non-fatal):
```
Invalid selector: .some-class
Could not get cache stats: extension not active on tab
```

Error (needs fixing):
```
Translation error: API returned 500
Error translating "some text": Network error
```

## Performance Optimization

### For Slow Connections
1. Use a self-hosted LibreTranslate server
2. Reduce target language to fewer simultaneous translations
3. Disable "Auto-Detect Language"

### For Better Battery Life (Laptops)
1. Disable "Reduce Flicker" (reduces animation processing)
2. Increase cache duration
3. Close unused tabs

### For Best Translation Speed
1. Use Google Translate provider (usually fastest)
2. Increase cache size
3. Keep extension and browser updated

## Security Considerations

- ✅ No personal data collection
- ✅ No ads or tracking
- ✅ Translations sent only to chosen provider
- ✅ Settings stored only locally
- ⚠️ Note: Translation text is sent to external service (review provider's privacy policy)

## Next Steps

1. **Test it out**: Visit YouTube and enable translation
2. **Customize it**: Adjust languages and providers as needed
3. **Share feedback**: Report issues or suggest improvements
4. **Explore code**: Read the comments in each file to understand how it works
5. **Contribute**: Add features or improve existing code

## Uninstalling

If you need to remove the extension:

1. Open `brave://extensions/`
2. Find "SubTranslate" in the list
3. Click the **Remove** button
4. Confirm removal

All your settings will be deleted.

---

**Happy translating! Enjoy seamless subtitle translation! 🎬🌍**

For more information, check the main README.md file or the comments in the code.
