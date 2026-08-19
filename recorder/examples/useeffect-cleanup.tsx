// @title useEffect — cleanup prevents memory leaks
// @hook useEffect
import { useState, useEffect } from 'react';

// @annotate:function-decl Component declaration | Timer subscribes to a setInterval in an effect. Without cleanup, the interval keeps firing after the component is removed or after the dep changes — stacking up multiple live intervals.
export default function Timer() {
  const [active, setActive] = useState(false);
  const [ticks, setTicks] = useState(0);

  // @note The cleanup function (the return value) runs before the next effect
  // execution and on unmount. Clearing the interval here means only one interval
  // is ever alive at a time.
  // @annotate:side-effect setInterval subscription | setInterval is a side effect — it reaches outside React and sets up a recurring callback. Effects are the right place to start and stop subscriptions like this.
  // @annotate:closure Cleanup captures intervalId | The returned cleanup function closes over the specific intervalId created in this effect run. Each re-run creates a new id; each cleanup disposes exactly its own run's interval.
  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      setTicks((t) => t + 1);
    }, 100);

    // Without this return, the old interval keeps running when `active` changes
    return () => clearInterval(id);
  }, [active]);

  return (
    <div>
      <span id="ticks">{ticks}</span>
      <button id="toggle" onClick={() => setActive((a) => !a)}>
        {active ? 'stop' : 'start'}
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
  click('#toggle'); // start
  await tick(250);
  click('#toggle'); // stop — cleanup fires here
};
