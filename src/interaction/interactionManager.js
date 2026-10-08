// InteractionManager: the single business entry point for every input device.
// Mouse, touch, XR controllers and hands all call hover(id, source) / select(id, source); the target
// decides what "select" means (e.g. selecting VIB-01 runs the same code from any device).
// source examples: "mouse", "touch", "xr-pointer-3" (controller ray), "hand-left", "hand-right".
// Pure module (no Babylon), unit-tested.

export function createInteractionManager() {
  const targets = new Map(); // id → { id, kind, onHover?(on), onSelect?(source) }
  const hoverBySource = new Map(); // source → id
  const listeners = { select: new Set(), hover: new Set() };
  const log = [];

  const hoverCount = (id) => [...hoverBySource.values()].filter((v) => v === id).length;
  const refresh = (id) => {
    if (id == null) return;
    targets.get(id)?.onHover?.(hoverCount(id) > 0);
  };

  return {
    addTarget(t) {
      targets.set(t.id, t);
      return () => targets.delete(t.id);
    },
    has: (id) => targets.has(id),
    /** Sets what `source` points at (null = nothing). A target stays hovered while any source hovers it. */
    hover(id, source) {
      const next = id != null && targets.has(id) ? id : null;
      const prev = hoverBySource.get(source) ?? null;
      if (prev === next) return;
      if (next === null) hoverBySource.delete(source);
      else hoverBySource.set(source, next);
      refresh(prev);
      refresh(next);
      listeners.hover.forEach((fn) => fn({ id: next, source }));
    },
    /** Runs the target's business action. Returns false for unknown targets. */
    select(id, source) {
      const t = targets.get(id);
      if (!t) return false;
      t.onSelect?.(source);
      const ev = { id, source, kind: t.kind, time: Date.now() };
      log.push(ev);
      if (log.length > 50) log.shift();
      listeners.select.forEach((fn) => fn(ev));
      return true;
    },
    hoveredBy: (source) => hoverBySource.get(source) ?? null,
    isHovered: (id) => hoverCount(id) > 0,
    onSelect(fn) {
      listeners.select.add(fn);
      return () => listeners.select.delete(fn);
    },
    onHover(fn) {
      listeners.hover.add(fn);
      return () => listeners.hover.delete(fn);
    },
    /** Recent selections (tests / diagnostics). */
    get log() {
      return [...log];
    },
  };
}
