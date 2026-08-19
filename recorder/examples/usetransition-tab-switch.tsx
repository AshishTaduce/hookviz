// @title useTransition — marking an update low priority
// @hook useTransition
import { useState, useTransition } from 'react';

export default function TabSwitcher() {
  const [tab, setTab] = useState('home');
  // @annotate:comment Concurrent hook | isPending tells you a transition is still in flight; startTransition is the scheduling handle.
  const [isPending, startTransition] = useTransition();

  // @note startTransition marks the update inside it as low priority — React can interrupt or defer it for more urgent work.
  const selectTab = (next: string) => {
    startTransition(() => {
      setTab(next);
    });
  };

  return (
    <div>
      <span id="tab">{isPending ? 'pending' : tab}</span>
      <button id="about" onClick={() => selectTab('about')}>
        about
      </button>
    </div>
  );
}

export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#about');
};
