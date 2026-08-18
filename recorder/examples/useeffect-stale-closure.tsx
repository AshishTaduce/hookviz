// @title useEffect — stale closure in an empty-deps effect
// @hook useEffect
import { useState, useEffect, useRef } from 'react';

export default function StaleClosure() {
  const [count, setCount] = useState(0);
  const renders = useRef(0);

  // @note An empty dep array means this closure captures `count` once, at mount — forever.
  useEffect(() => {
    const captured = count;
    document.title = `captured ${captured}`;
  }, []);

  // @note This one re-subscribes whenever `count` changes, so it never goes stale.
  useEffect(() => {
    document.title = `fresh ${count}`;
  }, [count]);

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
