import test from 'node:test';
import assert from 'node:assert/strict';
import { configureSeekableAction, seekAnimationAction } from '../lib/runtime/seekAnimationAction.js';

class FakeAction {
  constructor() {
    this.enabled = false;
    this.paused = true;
    this.clampWhenFinished = false;
    this.loop = null;
    this.repetitions = 0;
    this.timeScale = 0;
    this.played = false;
  }
  setLoop(loop, repetitions) { this.loop = loop; this.repetitions = repetitions; return this; }
  play() { this.played = true; return this; }
  setEffectiveTimeScale(value) { this.timeScale = value; return this; }
}

class FakeMixer {
  constructor(action) { this.action = action; this.time = 0; }
  setTime(value) {
    this.time = value;
    if (value === 11) this.action.paused = true; // simulate clamp-at-final behavior
  }
}

test('seek helper re-arms a LoopOnce action after the final frame', () => {
  const action = new FakeAction();
  const mixer = new FakeMixer(action);
  configureSeekableAction(action, 'LOOP_ONCE');
  assert.equal(action.enabled, true);
  assert.equal(action.paused, false);
  assert.equal(action.clampWhenFinished, true);
  assert.equal(action.played, true);

  assert.equal(seekAnimationAction(mixer, action, 11, 11), 11);
  assert.equal(action.paused, true);

  assert.equal(seekAnimationAction(mixer, action, 5.5, 11), 5.5);
  assert.equal(action.enabled, true);
  assert.equal(action.paused, false);
  assert.equal(action.timeScale, 1);
  assert.equal(mixer.time, 5.5);

  assert.equal(seekAnimationAction(mixer, action, 0, 11), 0);
  assert.equal(seekAnimationAction(mixer, action, 5.5, 11), 5.5);
});

test('seek helper clamps invalid and out-of-range requests', () => {
  const action = new FakeAction();
  const mixer = new FakeMixer(action);
  configureSeekableAction(action, 'LOOP_ONCE');
  assert.equal(seekAnimationAction(mixer, action, -4, 11), 0);
  assert.equal(seekAnimationAction(mixer, action, 50, 11), 11);
  assert.equal(seekAnimationAction(mixer, action, Number.NaN, 11), 0);
});
