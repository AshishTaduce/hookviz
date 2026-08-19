// @title useState — basic counter
// @hook useState
import { useState, useEffect } from 'react';

// @annotate:function-decl Component declaration | Counter is a function component — it re-runs top to bottom on every render.
export default function Counter() {
  // @note useState returns the current value and a setter. On mount it returns the initial value.
  const [count, setCount] = useState(0);
  const [step] = useState(1);

  // @note This effect is scheduled during render but only fires after commit.
  // @annotate:side-effect document.title assignment | Mutating document.title directly reaches outside React's render output — a side effect, which is exactly why it's fenced inside useEffect instead of the component body.
  useEffect(() => {
    document.title = `Count: ${count}`;
    return () => {
      document.title = 'cleaned up';
    };
  }, [count]);

  // @note `count` here is captured from this render's closure — it never changes mid-render.
  // @annotate:closure Closure over count | increment closes over count from this render; calling it later still uses the value captured at definition time, not whatever count is by then.
  const increment = () => {
    setCount(count + step);
  };

  return (
    <div>
      <span id="count">{count}</span>
      <button id="inc" onClick={increment}>
        increment
      </button>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#inc');
  click('#inc');
};
