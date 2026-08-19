// @title useMemo — why inline objects in deps defeat memoization
// @hook useMemo
import { useState, useMemo } from 'react';

function computeTotal(config: { items: number[]; multiplier: number }): number {
  return config.items.reduce((sum, n) => sum + n * config.multiplier, 0);
}

// @annotate:function-decl Component declaration | ObjectDepDemo shows the most common useMemo trap: passing an inline object as a dep. The object is a new reference every render, so the memo never caches — it's equivalent to no memo at all.
export default function ObjectDepDemo() {
  const [multiplier, setMultiplier] = useState(2);
  const [unrelated, setUnrelated] = useState(0);
  const items = [1, 2, 3, 4, 5];

  // @note The dep `{ items, multiplier }` is an inline object literal — a new
  // reference on every render. React compares deps by Object.is, so this always
  // fails the equality check and recomputes every time, even when multiplier hasn't changed.
  // @annotate:closure Inline object dep = no cache | { items, multiplier } is constructed fresh each render. React sees a new object reference every time, so the "did deps change?" check is always true. Remove the object wrapper and depend on the primitives directly.
  const brokenTotal = useMemo(
    () => computeTotal({ items, multiplier }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [{ items, multiplier }] // ← wrong: new object every render
  );

  // @note Depending on the primitives directly — not wrapped in an object —
  // gives React stable references to compare. Only recomputes when multiplier changes.
  const correctTotal = useMemo(
    () => computeTotal({ items, multiplier }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [multiplier] // ← items is module-stable; multiplier is a primitive
  );

  return (
    <div>
      <span id="broken">{brokenTotal}</span>
      <span id="correct">{correctTotal}</span>
      <button id="bump-unrelated" onClick={() => setUnrelated((n) => n + 1)}>
        re-render (unrelated: {unrelated})
      </button>
      <button id="bump-mult" onClick={() => setMultiplier((m) => m + 1)}>
        multiplier: {multiplier}
      </button>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#bump-unrelated'); // triggers broken memo to recompute, correct memo stays cached
  click('#bump-mult');      // both recompute — multiplier changed
};
