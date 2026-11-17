'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import catalog from '@/lib/catalog';
import { getPhaseSegments, PHASE_COLORS } from '@/lib/phase-segments';
import type { Trace } from '@/types/trace';

// Mini timeline thumbnail showing phase segments for a trace entry
// (we don't have step data in catalog entries, so we'll just show the hook name for now
// until we have a way to import mini traces. The full mini-timeline requires the trace.)
function MiniTimeline({ traceId }: { traceId: string }) {
  // We can't easily load the trace just for the thumbnail at popover render time
  // without a separate data structure. For v1, show a colored hook-type bar.
  const entry = catalog.find((e) => e.id === traceId);
  if (!entry) return null;
  return (
    <div
      style={{
        height: '4px',
        borderRadius: '2px',
        background: 'var(--phase-render)',
        width: '60px',
        opacity: 0.6,
      }}
    />
  );
}

export default function BreadcrumbPopover() {
  const { breadcrumbPopover, closePopover, trace } = useStore(
    useShallow((s) => ({
      breadcrumbPopover: s.breadcrumbPopover,
      closePopover: s.closePopover,
      trace: s.trace,
    }))
  );
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!breadcrumbPopover.open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopover();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [breadcrumbPopover.open, closePopover]);

  if (!breadcrumbPopover.open) return null;

  const scope = breadcrumbPopover.scope;

  // Filter catalog entries based on scope
  let entries = catalog;
  if (scope === 'category' && trace) {
    entries = catalog.filter((e) => e.category === trace.meta.category);
  } else if (scope === 'hook' && trace) {
    entries = catalog.filter((e) => e.hook === trace.meta.hook);
  } else if (scope === 'example' && trace) {
    entries = catalog.filter((e) => e.hook === trace.meta.hook);
  }

  // Group by hook when showing all (root/category scope)
  const needsGrouping = scope === 'root' || scope === 'category';

  const grouped = needsGrouping
    ? entries.reduce(
        (acc, entry) => {
          (acc[entry.hook] ??= []).push(entry);
          return acc;
        },
        {} as Record<string, typeof entries>
      )
    : null;

  const handleSelect = (id: string) => {
    closePopover();
    router.push(`/${id}`);
  };

  return (
    <div
      ref={popoverRef}
      className="pop-in"
      style={{
        position: 'fixed',
        top: 'var(--nav-height)',
        left: '12px',
        zIndex: 200,
        background: 'var(--bg-elevated)',
        border: 'var(--panel-border)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        minWidth: '280px',
        maxWidth: '360px',
        maxHeight: '60vh',
        overflowY: 'auto',
        padding: '8px 0',
      }}
    >
      {grouped
        ? Object.entries(grouped).map(([hook, hookEntries]) => (
            <div key={hook}>
              <div
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: '4px',
                }}
              >
                {hook}{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                  ({hookEntries.length})
                </span>
              </div>
              {hookEntries.map((entry) => (
                <PopoverItem
                  key={entry.id}
                  entry={entry}
                  isActive={entry.id === trace?.meta.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          ))
        : entries.map((entry) => (
            <PopoverItem
              key={entry.id}
              entry={entry}
              isActive={entry.id === trace?.meta.id}
              onSelect={handleSelect}
            />
          ))}
    </div>
  );
}

function PopoverItem({
  entry,
  isActive,
  onSelect,
}: {
  entry: (typeof catalog)[0];
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(entry.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 12px',
        background: isActive ? 'var(--bg-hover)' : 'none',
        border: 'none',
        borderLeft: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '13px',
        fontFamily: 'var(--sans)',
        lineHeight: 1.5,
        gap: '8px',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = isActive
          ? 'var(--bg-hover)'
          : 'none';
      }}
    >
      <span>{entry.title}</span>
      <MiniTimeline traceId={entry.id} />
    </button>
  );
}
