import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeBackground } from '../js/background.js';

test('background seeks to a real frame and remains paused', () => {
  for (const readyState of [0, 1]) {
    const events = {};
    const video = { readyState, duration: 20, currentTime: 0, paused: false,
      pause() { this.paused = true; },
      addEventListener(name, fn) { events[name] = fn; },
    };
    freezeBackground(video);
    if (!readyState) events.loadedmetadata();
    assert.equal(video.currentTime, 0.1);
    assert.equal(video.paused, true);
    video.paused = false; events.play();
    assert.equal(video.paused, true);
    events.seeked();
    assert.equal(video.paused, true);
  }
});