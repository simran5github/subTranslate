class SubtitleFileHandler {
  constructor(translationService) {
    this.translationService = translationService;
  }

  async handleSubtitleRequest(details) {
    const detection = detectSubtitleResource(details.url);
    if (!detection.isSubtitle) {
      return null;
    }

    try {
      const response = await fetch(details.url, { credentials: 'omit' });
      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      const translated = await translateSubtitleContent(text, async (segment) => {
        return this.translationService ? this.translationService.translate(segment, 'fr', 'en') : segment;
      });

      return {
        responseHeaders: [
          { name: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { name: 'X-SubTranslate-Intercepted', value: 'true' }
        ],
        body: translated
      };
    } catch (error) {
      console.debug('Subtitle interception failed:', error);
      return null;
    }
  }
}

function detectSubtitleResource(url) {
  if (!url) {
    return { isSubtitle: false, type: null, url };
  }

  const normalized = url.toLowerCase();
  if (normalized.endsWith('.vtt')) {
    return { isSubtitle: true, type: 'vtt', url };
  }
  if (normalized.endsWith('.srt')) {
    return { isSubtitle: true, type: 'srt', url };
  }
  if (normalized.includes('ttml') || normalized.includes('xml')) {
    return { isSubtitle: false, type: null, url };
  }

  return { isSubtitle: false, type: null, url };
}

async function translateSubtitleContent(content, translateFn) {
  const lines = content.split(/\r?\n/);
  const translatedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      translatedLines.push(line);
      continue;
    }

    if (/^WEBVTT|^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/.test(trimmed)) {
      translatedLines.push(line);
      continue;
    }

    const translated = await translateFn(trimmed);
    translatedLines.push(translated);
  }

  return translatedLines.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SubtitleFileHandler, detectSubtitleResource, translateSubtitleContent };
}
