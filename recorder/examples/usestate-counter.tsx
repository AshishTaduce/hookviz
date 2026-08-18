// @title useState — basic counter
// @hook useState
import { useState, useEffect } from 'react';

export default function Counter() {
  // @note useState returns the current value and a setter. On mount it returns the initial value.
  const [count, setCount] = useState(0);
  const [step] = useState(1);

  // @note This effect is scheduled during render but only fires after commit.
  useEffect(() => {
    document.title = `Count: ${count}`;
    return () => {
      document.title = 'cleaned up';
    };
  }, [count]);

  // @note `count` here is captured from this render's closure — it never changes mid-render.
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
