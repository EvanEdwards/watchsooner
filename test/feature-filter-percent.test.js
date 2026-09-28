const test = require('node:test');
const assert = require('node:assert/strict');
const { extractPercentFromStyle, getWatchedPercent, shouldShow } = require('../src/feature-filter-percent.js');

test('extractPercentFromStyle parses plain percentages', () => {
  assert.equal(extractPercentFromStyle('42%'), 42);
  assert.equal(extractPercentFromStyle('0%'), 0);
  assert.equal(extractPercentFromStyle('100%'), 100);
});

test('extractPercentFromStyle parses fractional percentages', () => {
  assert.equal(extractPercentFromStyle('7.5%'), 7.5);
});

test('extractPercentFromStyle rejects malformed or missing input', () => {
  assert.equal(extractPercentFromStyle(''), null);
  assert.equal(extractPercentFromStyle(null), null);
  assert.equal(extractPercentFromStyle(undefined), null);
  assert.equal(extractPercentFromStyle('auto'), null);
  assert.equal(extractPercentFromStyle('42px'), null);
});

test('getWatchedPercent reads the #progress element width', () => {
  const item = {
    querySelector(selector) {
      assert.equal(selector, '#progress');
      return { style: { width: '63%' } };
    },
  };
  assert.equal(getWatchedPercent(item), 63);
});

test('getWatchedPercent returns null when there is no progress bar', () => {
  const item = { querySelector: () => null };
  assert.equal(getWatchedPercent(item), null);
});

test('getWatchedPercent returns null for a missing element', () => {
  assert.equal(getWatchedPercent(null), null);
});

test('getWatchedPercent falls back to the overlay div when #progress is absent', () => {
  // Newer YouTube markup: ytw-thumbnail-overlay-resume-playback-renderer wraps an
  // unlabeled <div style="width: NN%"> instead of an element with id="progress".
  const percentDiv = { style: { width: '37%' } };
  const otherDiv = { style: { width: '' } };
  const overlay = {
    querySelectorAll: () => [otherDiv, percentDiv],
  };
  const item = {
    querySelector(selector) {
      if (selector === '#progress') return null;
      return overlay;
    },
  };
  assert.equal(getWatchedPercent(item), 37);
});

test('getWatchedPercent returns null when the overlay has no percent div', () => {
  const overlay = { querySelectorAll: () => [{ style: { width: '' } }] };
  const item = {
    querySelector(selector) {
      if (selector === '#progress') return null;
      return overlay;
    },
  };
  assert.equal(getWatchedPercent(item), null);
});

test('shouldShow keeps items inside the min/max range', () => {
  assert.equal(shouldShow(50, 0, 100), true);
  assert.equal(shouldShow(0, 0, 100), true);
  assert.equal(shouldShow(100, 0, 100), true);
  assert.equal(shouldShow(20, 25, 75), false);
  assert.equal(shouldShow(80, 25, 75), false);
});

test('shouldShow treats videos with no progress bar as 0% watched', () => {
  assert.equal(shouldShow(null, 0, 50), true);
  assert.equal(shouldShow(null, 10, 50), false);
});
