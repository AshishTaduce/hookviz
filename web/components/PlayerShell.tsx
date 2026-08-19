'use client';

import { useEffect } from 'react';
import type { Trace } from '@/types/trace';
import { useStore } from '@/store';
import TopNav from '@/components/TopNav';
import CodePanel from '@/components/panels/CodePanel';
import DomPanel from '@/components/panels/DomPanel';
import HooksPanel from '@/components/panels/HooksPanel';
import EffectsPanel from '@/components/panels/EffectsPanel';
import VariablesPanel from '@/components/panels/VariablesPanel';
import Player from '@/components/Player';
import BreadcrumbPopover from '@/components/BreadcrumbPopover';

interface Props {
  trace: Trace;
}

// PlayerShell receives the server-loaded trace, seeds the store, and renders
// the four-zone layout.
export default function PlayerShell({ trace }: Props) {
  const loadTrace = useStore((s) => s.loadTrace);

  // Seed the store with the server-provided trace immediately.
  // This avoids the async import inside loadTrace for the initial page load,
  // but we still call loadTrace to set status/traceId correctly.
  useEffect(() => {
    // We have the trace already; directly set it rather than re-importing.
    useStore.setState({
      trace,
      traceId: trace.meta.id,
      status: 'ready',
      stepIndex: 0,
      isPlaying: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace.meta.id]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'var(--nav-height) 1fr var(--player-height)',
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* Top nav */}
      <TopNav trace={trace} />

      {/* Main content: left code panel + right stacked panels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          overflow: 'hidden',
          borderTop: 'var(--panel-border)',
          borderBottom: 'var(--panel-border)',
        }}
      >
        {/* Left: Code panel */}
        <div
          style={{
            borderRight: 'var(--panel-border)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CodePanel trace={trace} />
        </div>

        {/* Right: stacked inspector panels */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* DOM panel gets more vertical space — ~35% */}
          <div style={{ flex: '0 0 35%', borderBottom: 'var(--panel-border)', overflow: 'hidden' }}>
            <DomPanel />
          </div>
          {/* Hooks panel */}
          <div style={{ flex: '1 1 0', borderBottom: 'var(--panel-border)', overflow: 'hidden' }}>
            <HooksPanel />
          </div>
          {/* Effects panel */}
          <div style={{ flex: '1 1 0', borderBottom: 'var(--panel-border)', overflow: 'hidden' }}>
            <EffectsPanel />
          </div>
          {/* Variables panel */}
          <div style={{ flex: '1 1 0', overflow: 'hidden' }}>
            <VariablesPanel />
          </div>
        </div>
      </div>

      {/* Bottom: Player + timeline */}
      <Player trace={trace} />

      {/* Breadcrumb popover (portal-like, positioned by TopNav trigger) */}
      <BreadcrumbPopover />
    </div>
  );
}
