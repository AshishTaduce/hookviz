// @title useLayoutEffect — runs before paint, useEffect runs after
// @hook useLayoutEffect
import { useState, useEffect, useLayoutEffect, useRef } from 'react';

// @annotate:function-decl Component declaration | EffectOrder records when each effect runs into a ref, then lets you reveal the order. The surprise: the useEffect is declared FIRST in the source but runs LAST.
export default function EffectOrder() {
  const [shown, setShown] = useState('(click to reveal)');
  const log = useRef<string[]>([]);

  // @note Declared first, but passive effects are deferred until after the browser
  // has painted the committed DOM. Their callbacks run later, so this logs second.
  // @annotate:side-effect Passive effect (post-paint) | useEffect is scheduled after paint so it never delays the screen update. Right for subscriptions and fetching; wrong for work that must finish before the user sees the frame.
  useEffect(() => {
    log.current.push('useEffect (after paint)');
  }, []);

  // @note Declared second, but layout effects run synchronously during the commit,
  // before the browser paints. Reading layout here (sizes, scroll) and updating state
  // is invisible to users because the re-render lands before the frame is shown.
  // @annotate:side-effect Layout effect (before paint) | useLayoutEffect blocks painting. Use it to measure the DOM and adjust synchronously (tooltip position, scroll restore). Keep the work tiny, because it delays every frame.
  useLayoutEffect(() => {
    log.current.push('useLayoutEffect (before paint)');
  }, []);

  return (
    <div>
      <span id="order">{shown}</span>
      <button id="reveal" onClick={() => setShown(log.current.join(' -> '))}>
        reveal order
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
  await tick(400); // mount: layout effect fires at commit, passive effect after
  click('#reveal'); // shows: useLayoutEffect first, useEffect second
  await tick(400);
};
