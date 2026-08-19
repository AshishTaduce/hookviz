// @title useTransition — isPending keeps the UI responsive
// @hook useTransition
import { useState, useTransition, memo } from 'react';

// A list large enough to make React work — not truly "slow" in jsdom,
// but the scheduling semantics are the same regardless of list size.
const ALL_ITEMS = Array.from({ length: 20 }, (_, i) => `item-${i + 1}`);

// @annotate:function-decl Memoized heavy list | SlowList re-renders whenever its `filter` prop changes. In a real app this might be thousands of rows or a complex tree. React can interrupt and defer this work when it's inside a transition.
const SlowList = memo(function SlowList({ filter }: { filter: string }) {
  const filtered = ALL_ITEMS.filter((item) => item.includes(filter));
  return (
    <ul id="list">
      {filtered.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
});

// @annotate:function-decl Component declaration | Search keeps two pieces of state: inputValue (urgent — updated immediately so the input feels responsive) and deferredFilter (non-urgent — wrapped in startTransition so React can defer re-rendering SlowList while the user is still typing).
export default function Search() {
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  // @note inputValue updates immediately (urgent) so the input character appears
  // in the box without delay. The SlowList re-render is wrapped in startTransition
  // (non-urgent) so React can interrupt it if another keystroke arrives first.
  // isPending is true from the moment startTransition is called until React
  // finishes all the deferred work inside it.
  // @annotate:comment isPending = deferred work in flight | isPending becomes true the moment startTransition fires and stays true until React commits all the renders scheduled inside the transition. Use it to show a loading indicator while the heavy update catches up.
  const handleChange = (value: string) => {
    setInputValue(value); // urgent: update the input immediately
    startTransition(() => {
      setFilter(value);   // deferred: let React schedule this at lower priority
    });
  };

  return (
    <div>
      <input
        id="search"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="filter items..."
      />
      {isPending && <span id="pending">updating…</span>}
      <SlowList filter={filter} />
    </div>
  );
}

export const scenario = async ({ type }: { type: (s: string, v: string) => void }) => {
  type('#search', 'item-1');
  type('#search', 'item-1');
};
