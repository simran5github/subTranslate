const test = require('node:test');
const assert = require('node:assert/strict');
const { detectSubtitleResource, translateSubtitleContent } = require('../utils/subtitle-file-handler');

test('detects subtitle resource URLs by extension', () => {
  assert.deepEqual(detectSubtitleResource('https://example.com/subtitles.vtt'), {
    isSubtitle: true,
    type: 'vtt',
    url: 'https://example.com/subtitles.vtt'
  });

  assert.deepEqual(detectSubtitleResource('https://example.com/captions.srt'), {
    isSubtitle: true,
    type: 'srt',
    url: 'https://example.com/captions.srt'
  });

  assert.deepEqual(detectSubtitleResource('https://example.com/track.xml'), {
    isSubtitle: false,
    type: null,
    url: 'https://example.com/track.xml'
  });
});

test('translates subtitle content while preserving cue structure', async () => {
  const input = `WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello world\n\n00:00:05.000 --> 00:00:08.000\nHow are you?`;

  const translated = await translateSubtitleContent(input, async (text) => {
    const map = {
      'Hello world': 'Bonjour le monde',
      'How are you?': 'Comment ça va ?'
    };
    return map[text] || text;
  });

  assert.match(translated, /Bonjour le monde/);
  assert.match(translated, /Comment ça va \?/);
  assert.match(translated, /WEBVTT/);
  assert.match(translated, /00:00:01.000 --> 00:00:04.000/);
});
