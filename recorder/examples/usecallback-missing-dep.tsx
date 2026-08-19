// @title useCallback — stale closure from a missing dependency
// @hook useCallback
import { useState, useCallback } from 'react';

// @annotate:function-decl Component declaration | StaleCbDemo shows what happens when useCallback omits a variable from its dep array: the callback freezes the value it closed over at creation time and never updates, even when the underlying state changes.
export default function StaleCbDemo() {
  const [count, setCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  // @note Empty dep array means this callback is created once — at mount.
  // `count` inside it is frozen at 0 forever. Every call logs "saw: 0"
  // no matter how many times count has been incremented since mount.
  // @annotate:closure Stale closure — count frozen at 0 | The callback closes over count from the render that created it. Empty deps means it's never recreated, so `count` inside is always the mount-time value regardless of current state.
  const stalePeek = useCallback(() => {
    setLog((l) => [...l, `stale saw: ${count}`]);
  }, []); // ← missing dep: count

  // @note Listing count as a dep means useCallback recreates the function
  // whenever count changes — the new closure captures the latest value.
  // @annotate:comment Correct dep list | Adding count to the dep array re-creates the callback on every count change. The new closure sees the fresh value. The tradeoff: child components receiving this callback will also re-render when count changes.
  const freshPeek = useCallback(() => {
    setLog((l) => [...l, `fresh saw: ${count}`]);
  }, [count]);

  return (
    <div>
      <button id="inc" onClick={() => setCount((c) => c + 1)}>count: {count}</button>
      <button id="stale" onClick={stalePeek}>stale peek</button>
      <button id="fresh" onClick={freshPeek}>fresh peek</button>
      <ul id="log">
        {log.map((entry, i) => <li key={i}>{entry}</li>)}
      </ul>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#inc');
  click('#inc');
  click('#stale'); // logs "stale saw: 0" — count is 2 but callback sees mount value
  click('#fresh'); // logs "fresh saw: 2"
};
