'use client';

import { useState, useRef, useCallback } from 'react';
import type { Trace } from '@/types/trace';
import { useStore, useStepNote } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { getPhaseSegments, PHASE_COLORS, PHASE_LABELS } from '@/lib/phase-segments';
import type { PhaseSegment } from '@/types/trace';
import Icon from '@/components/Icon';

interface Props {
  trace: Trace;
}

export default function Player({ trace }: Props) {
  const stepIndex = useStore((s) => s.stepIndex);
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const { prev, next, toggle, seek, setSpeed } = useStore(
    useShallow((s) => ({
      prev: s.prev,
      next: s.next,
      toggle: s.toggle,
      seek: s.seek,
      setSpeed: s.setSpeed,
    }))
  );
  const note = useStepNote();
  const audience = useStore((s) => s.audience);

  const total = trace.steps.length;
  const segments = getPhaseSegments(trace);
  const currentPhase = trace.steps[stepIndex]?.phase ?? 'idle';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'var(--player-height)',
        background: 'var(--bg-surface)',
        borderTop: 'var(--panel-border)',
        padding: '0',
      }}
    >
      {/* Top row: controls + step counter + phase label + speed + note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          height: '44px',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {/* Prev */}
        <ControlButton onClick={prev} disabled={stepIndex === 0} title="Previous step (←)">
          <Icon name="prev" />
        </ControlButton>

        {/* Play/Pause */}
        <ControlButton
          onClick={toggle}
          disabled={stepIndex >= total - 1 && !isPlaying}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} />
        </ControlButton>

        {/* Next */}
        <ControlButton onClick={next} disabled={stepIndex >= total - 1} title="Next step (→)">
          <Icon name="next" />
        </ControlButton>

        {/* Step counter */}
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            minWidth: '80px',
          }}
        >
          step {stepIndex + 1} / {total}
        </span>

        {/* Current phase badge */}
        <span className={`phase-badge phase-${currentPhase}`}>{currentPhase}</span>

        {/* Step note (Guided mode only) */}
        {audience === 'guided' && note && (
          <span
            style={{
              flex: 1,
              fontFamily: 'var(--sans)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingLeft: '8px',
              borderLeft: '1px solid var(--border)',
            }}
            title={note}
          >
            {note}
          </span>
        )}
        {audience === 'expert' && note && (
          <span
            title={note}
            style={{
              cursor: 'help',
              color: 'var(--text-muted)',
              fontSize: '11px',
              paddingLeft: '8px',
              borderLeft: '1px solid var(--border)',
            }}
          >
            <Icon name="info" size={14} />
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Speed selector */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>speed</span>
          {([0.5, 1, 2, 4] as const).map((s) => (
            <SpeedButton key={s} value={s} current={speed} onSelect={setSpeed} />
          ))}
        </div>
      </div>

      {/* Phase timeline bar */}
      <PhaseTimeline
        segments={segments}
        total={total}
        stepIndex={stepIndex}
        onSeek={seek}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase timeline
// ---------------------------------------------------------------------------

interface TimelineProps {
  segments: PhaseSegment[];
  total: number;
  stepIndex: number;
  onSeek: (i: number) => void;
}

export function PhaseTimeline({ segments, total, stepIndex, onSeek }: TimelineProps) {
  const [hover, setHover] = useState<{
    x: number;
    stepIndex: number;
    phase: string;
    line: number | null;
  } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const idx = Math.min(Math.floor(ratio * total), total - 1);
      const seg = segments.find((s) => idx >= s.start && idx <= s.end);
      setHover({
        x: e.clientX - rect.left,
        stepIndex: idx,
        phase: seg?.phase ?? 'idle',
        line: null, // we'd need the full trace here; skip line for v1
      });
    },
    [segments, total]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const idx = Math.min(Math.floor(ratio * total), total - 1);
      onSeek(idx);
    },
    [total, onSeek]
  );

  // Current step position as percentage
  const cursorPct = total > 1 ? (stepIndex / (total - 1)) * 100 : 0;

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        padding: '0 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
      onClick={handleClick}
    >
      {/* Segment bar */}
      <div
        ref={barRef}
        style={{
          display: 'flex',
          height: '14px',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {segments.map((seg, i) => {
          const pct = ((seg.end - seg.start + 1) / total) * 100;
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: PHASE_COLORS[seg.phase],
                opacity: 0.9,
                position: 'relative',
              }}
              title={PHASE_LABELS[seg.phase]}
            />
          );
        })}
      </div>

      {/* Current step cursor */}
      <div
        style={{
          position: 'absolute',
          left: `calc(12px + ${cursorPct}%)`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '2px',
          height: '20px',
          background: 'var(--text-primary)',
          borderRadius: '1px',
          pointerEvents: 'none',
          opacity: 0.9,
        }}
      />

      {/* Hover tooltip */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hover.x + 12, 300),
            bottom: '100%',
            background: 'var(--bg-elevated)',
            border: 'var(--panel-border)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: 'var(--mono)',
            color: PHASE_COLORS[hover.phase as keyof typeof PHASE_COLORS] ?? 'var(--text-primary)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          step {hover.stepIndex + 1} · {hover.phase}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ControlButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--sans)',
        fontSize: '13px',
        padding: '6px',
        borderRadius: '6px',
        lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 150ms var(--ease)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'none';
      }}
    >
      {children}
    </button>
  );
}

function SpeedButton({
  value,
  current,
  onSelect,
}: {
  value: 0.5 | 1 | 2 | 4;
  current: 0.5 | 1 | 2 | 4;
  onSelect: (s: 0.5 | 1 | 2 | 4) => void;
}) {
  const active = value === current;
  return (
    <button
      onClick={() => onSelect(value)}
      title={`${value}× speed`}
      style={{
        background: active ? 'var(--bg-hover)' : 'transparent',
        border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontFamily: 'var(--mono)',
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '6px',
        lineHeight: 1.4,
        transition: 'background-color 150ms var(--ease), color 150ms var(--ease)',
      }}
    >
      {value}×
    </button>
  );
}
