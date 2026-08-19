// @title useRef — persisting a value without re-rendering
// @hook useRef
import { useRef, useState } from 'react';

// @annotate:function-decl Component declaration | RenderCounter shows the difference between state and a ref: state triggers re-renders when it changes; mutating ref.current is invisible to the scheduler.
export default function RenderCounter() {
  const [value, setValue] = useState('');
  // @note useRef returns a stable container object — the same object reference across every render. Mutating .current never causes a re-render.
  // @annotate:comment Mutable container, not reactive | ref.current is a plain object property. React doesn't track reads or writes to it — no subscription, no re-render, no stale-closure hazard.
  const renderCount = useRef(0);
  renderCount.current += 1;

  return (
    <div>
      <input
        id="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="type here"
      />
      <span id="renders">renders: {renderCount.current}</span>
    </div>
  );
}

export const scenario = async ({ type }: { type: (s: string, v: string) => void }) => {
  type('#input', 'h');
  type('#input', 'hi');
};
