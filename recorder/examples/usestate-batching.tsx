// @title useState — why two setCount calls only increment once
// @hook useState
import { useState } from 'react';

// @annotate:function-decl Component declaration | BatchingDemo shows React 18's automatic batching: multiple state updates inside a single event handler are merged into one re-render instead of triggering one re-render per call.
export default function BatchingDemo() {
  const [count, setCount] = useState(0);

  // @note Both setCount calls read the same `count` from this render's closure.
  // Even though we call setCount twice, `count` is still 0 both times — we write
  // 0+1 twice, not 0+1 then 1+1. React batches the two into one re-render with count=1.
  // @annotate:closure Stale read in non-functional update | Both calls close over `count` from the current render. Neither sees the result of the other. This is why you get 1 instead of 2.
  const doubleIncrement = () => {
    setCount(count + 1); // reads: 0 → writes: 1
    setCount(count + 1); // reads: 0 again → writes: 1 again
  };

  // @note Functional updates are queued, not merged — each receives the latest
  // pending value, so two calls here correctly produce +2.
  // @annotate:comment Functional update fixes it | setCount(c => c + 1) receives the value from the previous queued update, not the closed-over snapshot. The two calls chain: 0 → 1 → 2.
  const correctDoubleIncrement = () => {
    setCount((c) => c + 1);
    setCount((c) => c + 1);
  };

  return (
    <div>
      <span id="count">{count}</span>
      <button id="wrong" onClick={doubleIncrement}>+2 (broken)</button>
      <button id="correct" onClick={correctDoubleIncrement}>+2 (fixed)</button>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#wrong');   // increments by 1, not 2 — the gotcha
  click('#correct'); // increments by 2 — the fix
};
