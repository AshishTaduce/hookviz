'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'hookviz:hint-dismissed';

// One-time pointer to the guide. Remembered in localStorage; if storage is
// unavailable the hint simply shows each visit.
export default function FirstVisitHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* storage unavailable: hint will reappear next visit */
    }
  };

  return (
    <div
      role="status"
      className="slide-in"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(var(--player-height) + 16px)',
        zIndex: 150,
        width: 320,
        padding: 16,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>
        New here? Step with <span className="keycap">←</span> <span className="keycap">→</span> and
        watch every panel follow the highlighted line.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Link className="btn" style={{ height: 32 }} href="/guide" onClick={dismiss}>
          Read the guide
        </Link>
        <button className="btn" style={{ height: 32, background: 'transparent', borderColor: 'transparent', color: 'var(--text-secondary)' }} onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
