// @title useEffect — an inline object dependency re-runs the effect every render
// @hook useEffect
import { useState, useEffect } from 'react';

const STABLE_OPTIONS = { step: 1 };

// @annotate:function-decl Component declaration | ObjectDepLoop has an effect that sets state. With an object dependency created during render, that effect keeps re-triggering itself. A safety cap (5) stops the demo; real code has no such cap and would loop forever.
export default function ObjectDepLoop() {
  const [stable, setStable] = useState(false);
  const [runs, setRuns] = useState(0);
  const [, forceRender] = useState(0);

  // @note { step: 1 } is a brand-new object on every render, so Object.is says the
  // dependency changed every time. Each effect run calls setRuns, which renders
  // again, which creates another new object, which re-runs the effect.
  // @annotate:closure New identity every render | The dependency array compares by reference. Two objects with identical contents are still different values, so an object (or array or function) created inline is always "changed".
  const options = stable ? STABLE_OPTIONS : { step: 1 };

  // @note With STABLE_OPTIONS the reference never changes, so after one run the
  // effect stays quiet. The usual fixes: depend on the primitive (options.step),
  // memoize the object with useMemo, or hoist it out of the component.
  // @annotate:side-effect Effect that sets state | An effect that updates state it indirectly depends on is a loop waiting to happen. The cap below only exists so this demo terminates.
  useEffect(() => {
    setRuns((r) => (r < 5 ? r + options.step : r));
  }, [options]);

  return (
    <div>
      <span id="runs">{runs}</span>
      <button
        id="fix"
        onClick={() => {
          setStable(true);
          setRuns(0);
        }}
      >
        use stable object
      </button>
      <button id="rerender" onClick={() => forceRender((n) => n + 1)}>
        re-render
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
  await tick(400); // loop runs until the cap: runs climbs 1..5
  click('#fix'); // switch to a stable reference
  await tick(400);
  click('#rerender'); // re-render: the effect does NOT re-run, the dependency is unchanged
  await tick(400);
};
