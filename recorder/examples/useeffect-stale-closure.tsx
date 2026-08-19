// @title useEffect — stale closure in an empty-deps effect
// @hook useEffect
import { useState, useEffect, useRef } from 'react';

// @annotate:function-decl Component declaration | StaleClosure is a function component — every render creates fresh closures for everything defined inside it, including the effect callbacks below.
export default function StaleClosure() {
  const [count, setCount] = useState(0);
  const renders = useRef(0);

  // @note An empty dep array means this closure captures `count` once, at mount — forever.
  // @annotate:closure Stale closure | This callback closes over count from the render that scheduled it. Empty deps means it never gets recreated, so `captured` is frozen at whatever count was on mount.
  useEffect(() => {
    const captured = count;
    document.title = `captured ${captured}`;
  }, []);

  // @note This one re-subscribes whenever `count` changes, so it never goes stale.
  useEffect(() => {
    document.title = `fresh ${count}`;
  }, [count]);

  // @annotate:side-effect Mutating a ref during render | renders.current is mutated directly in the component body, not inside an effect. It's tolerated for refs (they don't trigger re-renders), but it's still a side effect happening during render.
  renders.current += 1;

  return (
    <button id="inc" onClick={() => setCount((c) => c + 1)}>
      {count}
    </button>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#inc');
  click('#inc');
};
