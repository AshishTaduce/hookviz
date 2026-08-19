// @title useCallback — stable function identity across renders
// @hook useCallback
import { useState, useCallback, memo } from 'react';

// @annotate:comment Memoized child | MyButton is wrapped with React.memo — it only re-renders when its props change by reference. Passing the same function reference across renders is what makes this work.
const MyButton = memo(function MyButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button id="btn" onClick={onClick}>
      {label}
    </button>
  );
});

// @annotate:function-decl Component declaration | Parent holds count state and passes a callback to a memoized child. Without useCallback every re-render creates a new function reference, defeating React.memo.
export default function Parent() {
  const [count, setCount] = useState(0);

  // @note useCallback returns the same function reference as long as its deps haven't changed. The empty dep array means handleClick is created once and reused forever.
  // @annotate:closure Stable callback identity | The callback closes over setCount (a stable setter — React guarantees it never changes). Empty deps: no captured values that change, so the cached function is always valid.
  const handleClick = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return (
    <div>
      <span id="count">{count}</span>
      <MyButton onClick={handleClick} label="increment" />
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#btn');
  click('#btn');
};
