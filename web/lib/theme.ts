'use client';

import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark';
const KEY = 'hookviz:theme';
const EVENT = 'hookviz-theme';

// Resolved theme: explicit data-theme (set by the toggle or the pre-paint
// script) wins, otherwise the OS preference.
export function resolveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage unavailable: theme still applies for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

// Switch theme. With an origin (the toggle's centre) and View Transitions
// support, the new theme spreads out from that point as a circle; otherwise it
// switches directly. Reduced-motion users always get the direct switch.
export function setTheme(t: Theme, origin?: { x: number; y: number }) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = (document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  }).startViewTransition;
  if (!origin || reduce || !start) {
    applyTheme(t);
    return;
  }
  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = start.call(document, () => {
    flushSync(() => applyTheme(t));
  });
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener(EVENT, cb);
  mq.addEventListener('change', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    mq.removeEventListener('change', cb);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, resolveTheme, () => 'dark' as Theme);
}

// Inline script run before first paint so the saved choice never flashes.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
