const test = require('node:test');
const assert = require('node:assert/strict');
const SubtitleDetector = require('../utils/subtitle-detector');

class MockElement {
  constructor({ tagName = 'div', className = '', id = '', textContent = '', parentElement = null, attributes = {} } = {}) {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.id = id;
    this.textContent = textContent;
    this.parentElement = parentElement;
    this.children = [];
    this.dataset = {};
    this.attributes = { ...attributes };
    this.isConnected = true;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  closest(selector) {
    if (!selector) return null;
    let current = this;
    while (current) {
      const classNames = (current.className || '').toString().toLowerCase();
      const id = (current.id || '').toLowerCase();
      const role = (current.getAttribute('role') || '').toLowerCase();
      const matches = selector.includes('[role="button"]')
        ? role === 'button'
        : false;
      if (matches || (selector.includes('button') && classNames.includes('button'))) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  cloneNode() {
    return new MockElement({
      tagName: this.tagName,
      className: this.className,
      id: this.id,
      textContent: this.textContent,
      parentElement: this.parentElement,
      attributes: this.attributes,
    });
  }

  querySelectorAll() {
    return [];
  }
}

function installDomMocks() {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNode = global.Node;
  const originalNodeFilter = global.NodeFilter;

  global.window = {
    location: { href: 'https://example.com/watch' },
    getComputedStyle() {
      return {
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        fontSize: '16px',
      };
    },
  };

  global.document = {
    body: new MockElement({ tagName: 'body' }),
    querySelectorAll() {
      return [];
    },
    createTreeWalker() {
      return {
        nextNode() {
          return null;
        },
      };
    },
  };

  global.Node = { ELEMENT_NODE: 1 };
  global.NodeFilter = { SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

  return () => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.Node = originalNode;
    global.NodeFilter = originalNodeFilter;
  };
}

test('rejects metadata strings inside a player-like region', () => {
  const restore = installDomMocks();
  try {
    const detector = new SubtitleDetector();
    const player = new MockElement({ tagName: 'div', className: 'player', id: 'player' });
    const metadata = new MockElement({
      tagName: 'span',
      className: 'episode-title',
      textContent: 'Season 1 Episode 1',
      parentElement: player,
    });
    player.parentElement = null;
    metadata.parentElement = player;

    assert.equal(detector.isValidSubtitleElement(metadata), false);
  } finally {
    restore();
  }
});

test('accepts short caption-like text in a player-like region', () => {
  const restore = installDomMocks();
  try {
    const detector = new SubtitleDetector();
    const player = new MockElement({ tagName: 'div', className: 'player', id: 'player' });
    const caption = new MockElement({
      tagName: 'span',
      className: 'caption-text',
      textContent: 'Hello there',
      parentElement: player,
    });
    caption.parentElement = player;

    assert.equal(detector.isValidSubtitleElement(caption), true);
  } finally {
    restore();
  }
});
