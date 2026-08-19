// @title useMemo — skipping an expensive recalculation
// @hook useMemo
import { useState, useMemo } from 'react';

// Stable reference: defined outside the component, never triggers memo recalculation
const ITEMS = ['apple', 'apricot', 'banana', 'blueberry', 'cherry', 'cranberry'];

function expensiveFilter(items: string[], query: string): string[] {
  return items.filter((item) => item.includes(query));
}

// @annotate:function-decl Component declaration | FilterList re-filters a list as the query changes. useMemo caches the result so the filter only runs when its inputs actually change.
export default function FilterList() {
  const [query, setQuery] = useState('');

  // @note useMemo caches the return value between renders. React checks each dep by Object.is; only when query changes does it re-run expensiveFilter.
  // @annotate:closure Cached computation | The memo callback closes over query. ITEMS is defined outside the component so its reference is always the same — only query drives recalculation.
  const filtered = useMemo(() => expensiveFilter(ITEMS, query), [query]);

  return (
    <div>
      <input
        id="filter"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="filter..."
      />
      <ul id="list">
        {filtered.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export const scenario = async ({ type }: { type: (s: string, v: string) => void }) => {
  type('#filter', 'a');
  type('#filter', 'ap');
};
