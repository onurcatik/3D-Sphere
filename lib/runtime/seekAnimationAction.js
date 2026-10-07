/**
 * Primes a Three.js AnimationAction for deterministic timeline seeking.
 * The caller supplies the loop constant to keep this helper dependency-free
 * and directly testable even when the project dependencies are unavailable.
 */
export function configureSeekableAction(action, loopOnce) {
  action.enabled = true;
  action.paused = false;
  action.clampWhenFinished = true;
  action.setLoop(loopOnce, 1);
  action.play();
  return action;
}

/**
 * Seeks an AnimationMixer without trusting the action state left behind by a
 * previous visit to the final frame. Re-arming enabled/paused on every seek is
 * what makes 1 -> mid -> 0 -> mid navigation safe with LoopOnce actions.
 */
export function seekAnimationAction(mixer, action, seconds, duration) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const requested = Number.isFinite(seconds) ? seconds : 0;
  const time = Math.max(0, Math.min(safeDuration, requested));

  action.enabled = true;
  action.paused = false;
  if (typeof action.setEffectiveTimeScale === "function") action.setEffectiveTimeScale(1);
  mixer.setTime(time);
  return time;
}
