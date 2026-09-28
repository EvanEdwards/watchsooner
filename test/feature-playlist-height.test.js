const test = require('node:test');
const assert = require('node:assert/strict');
const { applyHeightOverride } = require('../src/feature-playlist-height.js');

function fakeStyle() {
  const props = {};
  return {
    props,
    setProperty(name, value) {
      props[name] = value;
    },
    removeProperty(name) {
      delete props[name];
    },
  };
}

function fakePanel(itemsStyle) {
  const style = fakeStyle();
  const items = { style: itemsStyle };
  return {
    style,
    querySelector: (selector) => (selector === '#items' ? items : null),
  };
}

test('applyHeightOverride(enabled) sets max-height:none scoped to the panel itself', () => {
  const itemsStyle = fakeStyle();
  const panel = fakePanel(itemsStyle);

  applyHeightOverride(panel, true);

  assert.equal(panel.style.props['--ytd-watch-flexy-panel-max-height'], 'none');
  assert.equal(panel.style.props['max-height'], 'none');
  assert.equal(itemsStyle.props['overflow-y'], 'visible');
  assert.equal(itemsStyle.props['height'], 'auto');
});

test('applyHeightOverride(disabled) removes the panel-scoped overrides entirely', () => {
  const itemsStyle = fakeStyle();
  const panel = fakePanel(itemsStyle);

  applyHeightOverride(panel, true);
  applyHeightOverride(panel, false);

  assert.equal('--ytd-watch-flexy-panel-max-height' in panel.style.props, false);
  assert.equal('max-height' in panel.style.props, false);
  assert.equal('overflow-y' in itemsStyle.props, false);
  assert.equal('height' in itemsStyle.props, false);
});

test('applyHeightOverride does nothing for a panel with no #items', () => {
  const panel = { style: fakeStyle(), querySelector: () => null };
  assert.doesNotThrow(() => applyHeightOverride(panel, true));
  assert.equal(Object.keys(panel.style.props).length, 0);
});

test('applyHeightOverride does nothing for a missing panel', () => {
  assert.doesNotThrow(() => applyHeightOverride(null, true));
});
