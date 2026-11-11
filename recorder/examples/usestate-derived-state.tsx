// @title useState — derived state mirrored in an effect lags a render behind
// @hook useState
import { useState, useEffect } from 'react';

// @annotate:function-decl Component declaration | Cart shows the same total two ways: copied into its own state by an effect, and computed directly during render. Compare the two numbers on the frame right after you add an item.
export default function Cart() {
  const [prices, setPrices] = useState<number[]>([10]);
  const [mirroredTotal, setMirroredTotal] = useState(10);

  // @note This is the anti-pattern: total is fully determined by prices, yet it is
  // stored as separate state and synced in an effect. After setPrices, React renders
  // once with the NEW prices but the OLD mirroredTotal, commits that inconsistent
  // frame, runs this effect, then renders a second time to fix it.
  // @annotate:side-effect Syncing state in an effect | Effects are for talking to things outside React. Copying one piece of state into another costs an extra render pass and shows users a frame where the two disagree.
  useEffect(() => {
    setMirroredTotal(prices.reduce((sum, p) => sum + p, 0));
  }, [prices]);

  // @note The fix: derive it. Anything computable from props or state should be
  // calculated during render. It is always in sync, with no effect and no extra render.
  // @annotate:comment Derived during render | No state, no effect. If the calculation is expensive, wrap it in useMemo, but start with a plain expression.
  const derivedTotal = prices.reduce((sum, p) => sum + p, 0);

  return (
    <div>
      <p>
        mirrored: <span id="mirrored">{mirroredTotal}</span>
      </p>
      <p>
        derived: <span id="derived">{derivedTotal}</span>
      </p>
      <button id="add" onClick={() => setPrices((p) => [...p, 10])}>
        add $10
      </button>
    </div>
  );
}

export const scenario = async ({
  click,
  tick,
}: {
  click: (s: string) => void;
  tick: (ms?: number) => Promise<void>;
}) => {
  click('#add'); // derived is 20 immediately; mirrored is still 10 on this frame
  await tick(50); // the effect fires and a second render lets mirrored catch up
};
