'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Trace } from '@/types/trace';
import { useStore, useCodeCursor, useStepNote } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { getPhaseSegments, PHASE_COLORS } from '@/lib/phase-segments';
import { PhaseTimeline } from '@/components/Player';
import { LogoMark } from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import Icon from '@/components/Icon';
import HooksPanel from '@/components/panels/HooksPanel';
import EffectsPanel from '@/components/panels/EffectsPanel';
import VariablesPanel from '@/components/panels/VariablesPanel';
import DomPanel from '@/components/panels/DomPanel';

const TABS = [
  ['hooks', 'Hooks'],
  ['effects', 'Effects'],
  ['vars', 'Variables'],
  ['output', 'Output'],
] as const;
type Tab = (typeof TABS)[number][0];

// Phone layout: one code card, one inspector tab at a time, thumb-sized
// controls. Same trace and store as the desktop player, no Monaco.
export default function MobilePlayer({ trace }: { trace: Trace }) {
  const stepIndex = useStore((s) => s.stepIndex);
  const isPlaying = useStore((s) => s.isPlaying);
  const audience = useStore((s) => s.audience);
  const { prev, next, toggle, seek, openPopover } = useStore(
    useShallow((s) => ({
      prev: s.prev,
      next: s.next,
      toggle: s.toggle,
      seek: s.seek,
      openPopover: s.openPopover,
    }))
  );
  const cursor = useCodeCursor();
  const note = useStepNote();
  const [tab, setTab] = useState<Tab>('hooks');

  const total = trace.steps.length;
  const segments = getPhaseSegments(trace);
  const phase = trace.steps[stepIndex]?.phase ?? 'idle';
  const lines = trace.meta.source.split('\n');
  const label = trace.meta.title.replace(/^[^—]+—\s*/, '');

  // Keep the current line centred in the code card
  const codeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = codeRef.current;
    if (!box || !cursor) return;
    const el = box.querySelector<HTMLElement>(`[data-line="${cursor.line}"]`);
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [cursor?.line]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: '52px minmax(0, 38fr) auto minmax(0, 40fr) auto', height: '100dvh', width: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'var(--bg-surface)', borderBottom: 'var(--panel-border)' }}>
        <div className="stripe" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <i /><i /><i /><i />
        </div>
        <Link href="/" aria-label="HookViz home" style={{ display: 'flex', padding: 4 }}>
          <LogoMark size={24} />
        </Link>
        <button
          onClick={() => openPopover('root')}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>{trace.meta.hook}</span>
        </button>
        <ThemeToggle />
      </div>

      {/* Code card */}
      <div ref={codeRef} style={{ overflow: 'auto', padding: '8px 0', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: '20px', borderBottom: 'var(--panel-border)', background: 'var(--bg-base)' }}>
        {lines.map((text, i) => {
          const n = i + 1;
          const on = cursor?.line === n;
          const isDirective = /^\s*\/\/\s*@/.test(text);
          return (
            <div
              key={n}
              data-line={n}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px max-content',
                whiteSpace: 'pre',
                color: on ? 'var(--text-primary)' : isDirective ? 'var(--text-muted)' : 'var(--text-secondary)',
                background: on ? `color-mix(in srgb, ${PHASE_COLORS[phase]} 16%, transparent)` : 'transparent',
                boxShadow: on ? `inset 3px 0 0 ${PHASE_COLORS[phase]}` : 'none',
              }}
            >
              <span style={{ paddingRight: 8, textAlign: 'right', color: on ? PHASE_COLORS[phase] : 'var(--text-muted)' }}>{n}</span>
              <span>{text}</span>
            </div>
          );
        })}
      </div>

      {/* Note + tabs */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: 'var(--panel-border)' }}>
        {audience === 'guided' && note && (
          <p style={{ padding: '8px 12px 0', fontSize: 12, lineHeight: '16px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note}</p>
        )}
        <div role="tablist" style={{ display: 'flex', gap: 4, padding: 8 }}>
          {TABS.map(([k, name]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              style={{ flex: 1, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, background: tab === k ? 'var(--accent)' : 'transparent', color: tab === k ? 'var(--accent-contrast)' : 'var(--text-secondary)' }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Inspector */}
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        {tab === 'hooks' && <HooksPanel />}
        {tab === 'effects' && <EffectsPanel />}
        {tab === 'vars' && <VariablesPanel />}
        {tab === 'output' && <DomPanel />}
      </div>

      {/* Controls */}
      <div style={{ background: 'var(--bg-surface)', borderTop: 'var(--panel-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
          <button className="m-ctl" onClick={prev} disabled={stepIndex === 0} aria-label="Previous step"><Icon name="prev" size={20} /></button>
          <button className="m-ctl m-ctl-main" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}><Icon name={isPlaying ? 'pause' : 'play'} size={20} /></button>
          <button className="m-ctl" onClick={next} disabled={stepIndex >= total - 1} aria-label="Next step"><Icon name="next" size={20} /></button>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-secondary)' }}>step {stepIndex + 1} / {total}</span>
          <span className={`phase-badge phase-${phase}`}>{phase}</span>
        </div>
        <div style={{ height: 36 }}>
          <PhaseTimeline segments={segments} total={total} stepIndex={stepIndex} onSeek={seek} />
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
