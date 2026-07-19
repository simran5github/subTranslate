# Quick Reference

## Installation (30 seconds)

```bash
# Copy the subTranslate folder to your computer
cd /path/to/subTranslate

# Open brave://extensions/ in Brave Browser
# Enable Developer Mode (toggle, top-right)
# Click "Load unpacked"
# Select the subTranslate folder
# Done! Click the extension icon to enable it
```

## First Use

1. Go to **YouTube.com**
2. Find a video with subtitles
3. Click the **SubTranslate icon** (🎬) in your toolbar
4. Toggle **"Enable Translation"** to ON
5. Select languages (English → French by default)
6. Enjoy instant subtitle translation!

## File Quick Reference

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config & permissions |
| `background.js` | Background service worker |
| `content-script.js` | Main translation logic |
| `popup.html/.js/.css` | Settings UI |
| `utils/translator.js` | Translation service providers |
| `utils/cache.js` | Translation caching system |
| `utils/storage.js` | Settings persistence |
| `utils/subtitle-detector.js` | Subtitle element finding |
| `README.md` | Full documentation |
| `SETUP_GUIDE.md` | Setup instructions |
| `DEVELOPER_GUIDE.md` | Development guide |

## Common Tasks

### Change Default Language
Edit `utils/storage.js`, line 12:
```javascript
targetLang: 'es', // Change 'fr' to your language
```

### Use Self-Hosted Translation Server
Edit `utils/translator.js`, line 50:
```javascript
constructor(apiUrl = 'http://localhost:5000') {
  this.apiUrl = apiUrl;
}
```

### Add Support for New Video Site
Edit `utils/subtitle-detector.js`, add to `selectors`:
```javascript
newsite: ['.subtitle-selector-1', '.subtitle-selector-2']
```

### Clear Extension Cache
Click the extension icon → "Clear Cache" button

### Debugging
Open DevTools (F12) on any video page → Console tab

## Keyboard Shortcuts

Coming in v1.1! Currently available in popup only.

## Supported Languages

**12+ languages supported:**
English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Hindi

## Supported Platforms

✅ YouTube  
✅ Netflix  
✅ Disney+  
✅ Prime Video  
✅ Hulu  
✅ Crunchyroll  
✅ Hotstar  
✅ Most HTML5 video sites  

## Translation Providers

- **LibreTranslate** (Default) - Free, open-source
- **Google Translate** - High quality
- **MyMemory** - Free, community-driven

## Settings Explained

| Setting | What It Does |
|---------|--------------|
| Enable Translation | Turn subtitle translation on/off |
| Source Language | Language to translate FROM |
| Target Language | Language to translate TO |
| Translation Provider | Which service to use |
| Reduce Flicker | Smooth transitions (uses more CPU) |
| Auto-Detect Language | Detect source language automatically |

## Performance Metrics

- Cache size: Up to 500 translations
- MutationObserver debounce: 100ms
- Typical API response time: 200-800ms
- Cache hit rate (normal): 40-70%

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No subtitles translating | 1) Check enabled 2) Check console 3) Clear cache |
| Poor translation | Try different provider |
| API errors | Check internet, try different provider |
| Not showing on site | Site may not have HTML5 video |
| High memory use | Close unused tabs, clear cache |

## Advanced

### View Cache Stats
```javascript
// In console on any video page
chrome.tabs.query({active: true}, tabs => {
  chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, 
    r => console.log(r.stats))
})
```

### Test Translation
```javascript
const service = new TranslationService('libretranslate')
service.translate('Hello World', 'fr', 'en').then(console.log)
```

### Clear All Settings
Extension icon → Settings (gear icon) → "Reset Settings"

## Developer Features

- Full source code with comments
- Modular architecture for easy extension
- Debug logging in console
- Error handling with try/catch
- Performance optimized with caching
- Support for multiple translation providers

## File Sizes

- manifest.json: ~2 KB
- content-script.js: ~9 KB
- background.js: ~2 KB
- popup.html/js/css: ~8 KB
- utils/: ~15 KB
- Total: ~36 KB (very lightweight!)

## Browser Compatibility

- ✅ Brave Browser 1.0+
- ✅ Google Chrome 90+
- ✅ Chromium-based browsers
- ❌ Firefox (uses different extension API)
- ❌ Safari (uses different extension API)

## License & Credits

- **License**: MIT (free to use, modify, share)
- **Translation Services**: LibreTranslate, Google, MyMemory
- **Browser API**: Chrome Extension API v3

## Getting Help

1. Check the **console** (F12) for error messages
2. Read the **README.md** for detailed docs
3. Check **SETUP_GUIDE.md** for installation help
4. Review **DEVELOPER_GUIDE.md** for technical details
5. Enable developer mode and inspect the code

## Quick Commands

```bash
# Make setup script executable (Linux/Mac)
chmod +x setup-icons.sh

# Run setup script
./setup-icons.sh

# View your settings (in popup console)
new StorageManager().getAll()

# Test cache
new TranslationCache().batchGet(['hello'], 'fr')
```

---

**Need help? Check README.md or SETUP_GUIDE.md!**

**Want to contribute? See DEVELOPER_GUIDE.md!**
