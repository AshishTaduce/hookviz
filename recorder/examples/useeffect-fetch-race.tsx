// @title useEffect — out-of-order responses overwrite newer data
// @hook useEffect
import { useState, useEffect } from 'react';

// A fake network call: the "slow" query takes 300ms, every other query 100ms.
const fakeFetch = (query: string) =>
  new Promise<string>((resolve) => setTimeout(() => resolve(`results for ${query}`), query === 'slow' ? 300 : 100));

// @annotate:function-decl Component declaration | Search fires a request whenever the query changes. Two quick changes start two requests, and responses can arrive in a different order than they were sent.
export default function Search() {
  const [query, setQuery] = useState('start');
  const [guard, setGuard] = useState(false);
  const [result, setResult] = useState('');

  // @note Without a guard, whichever response arrives LAST wins, even if it belongs
  // to an old query. Here "slow" is requested first but resolves after "fast", so the
  // stale answer overwrites the fresh one and the screen disagrees with the query.
  // @annotate:side-effect Async request in an effect | The effect returns before the request finishes. Each run starts its own request, and nothing cancels the earlier ones.
  // @annotate:closure Cleanup flips this run's flag | The cleanup closes over `ignore` from its own run. When the query changes, React runs the old cleanup, so an old request can no longer call setResult.
  useEffect(() => {
    let ignore = false;
    fakeFetch(query).then((r) => {
      if (guard && ignore) return;
      setResult(r);
    });
    return () => {
      ignore = true;
    };
  }, [query, guard]);

  return (
    <div>
      <p>
        query: <span id="query">{query}</span>
      </p>
      <p>
        showing: <span id="result">{result}</span>
      </p>
      <button id="slow" onClick={() => setQuery('slow')}>search "slow"</button>
      <button id="fast" onClick={() => setQuery('fast')}>search "fast"</button>
      <button id="guard" onClick={() => setGuard(true)}>turn guard on</button>
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
  await tick(150);
  click('#slow'); // request 1: resolves in 300ms
  click('#fast'); // request 2: resolves in 100ms, so it arrives first
  await tick(450); // the stale "slow" answer lands last and wins (the bug)
  click('#guard'); // ignore responses from cleaned-up runs
  click('#slow');
  click('#fast');
  await tick(450); // now only the newest request may write the result
  await tick(50); // let the final render commit before the scenario ends
};
