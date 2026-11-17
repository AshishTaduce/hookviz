'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';

// true on phone-width viewports. null on the server and during hydration, so
// callers can wait one tick instead of flashing the desktop layout.
export function useIsNarrow(): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => null
  );
}
