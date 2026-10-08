// Robust pinch detection (pure, unit-tested).
//  - scale-invariant: thumb-tip ↔ index-tip distance divided by the palm length (wrist → middle knuckle),
//    so small and large hands behave the same;
//  - hysteresis: closes below START_RATIO, only reopens above END_RATIO (no flicker at the threshold);
//  - debounce: the closed state must persist DEBOUNCE_MS before PINCH_START (ignores tracking spikes);
//  - cooldown: no new PINCH_START within COOLDOWN_MS after a release (no double clicks);
//  - holding the pinch never re-fires PINCH_START (state PINCH until released).

export const PINCH_EVENTS = { OPEN: "OPEN", START: "PINCH_START", HOLD: "PINCH", END: "PINCH_END" };

export const PINCH_DEFAULTS = { startRatio: 0.25, endRatio: 0.4, debounceMs: 40, cooldownMs: 250 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Thumb–index gap relative to palm length; NaN when the joints are missing. */
export function pinchRatio(thumbTip, indexTip, wrist, middleKnuckle) {
  if (!thumbTip || !indexTip || !wrist || !middleKnuckle) return NaN;
  const palm = dist(wrist, middleKnuckle);
  if (!(palm > 1e-4)) return NaN;
  return dist(thumbTip, indexTip) / palm;
}

export function createPinchDetector(options = {}) {
  const o = { ...PINCH_DEFAULTS, ...options };
  let pinched = false;
  let candidateSince = null;
  let lastEnd = -Infinity;
  return {
    get pinched() {
      return pinched;
    },
    /** @returns one of PINCH_EVENTS for this frame. ratio = pinchRatio(...), now in ms. */
    update(ratio, now) {
      if (!Number.isFinite(ratio)) {
        // tracking lost: release cleanly, never start
        candidateSince = null;
        if (pinched) {
          pinched = false;
          lastEnd = now;
          return PINCH_EVENTS.END;
        }
        return PINCH_EVENTS.OPEN;
      }
      if (pinched) {
        if (ratio > o.endRatio) {
          pinched = false;
          lastEnd = now;
          return PINCH_EVENTS.END;
        }
        return PINCH_EVENTS.HOLD;
      }
      if (ratio < o.startRatio) {
        if (candidateSince === null) candidateSince = now;
        if (now - candidateSince >= o.debounceMs && now - lastEnd >= o.cooldownMs) {
          pinched = true;
          candidateSince = null;
          return PINCH_EVENTS.START;
        }
        return PINCH_EVENTS.OPEN;
      }
      candidateSince = null;
      return PINCH_EVENTS.OPEN;
    },
    reset() {
      pinched = false;
      candidateSince = null;
      lastEnd = -Infinity;
    },
  };
}
