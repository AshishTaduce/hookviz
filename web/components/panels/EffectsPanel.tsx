'use client';

import { useEffectsList } from '@/store';
import type { EffectSnapshot, EffectStatus } from '@/types/trace';

const STATUS_LABELS: Record<EffectStatus, string> = {
  scheduled: 'scheduled',
  fired: 'fired',
  'cleanup-pending': 'cleanup-pending',
  'cleaned-up': 'cleaned-up',
};

const STATUS_COLORS: Record<EffectStatus, string> = {
  scheduled: '#e0b15a',
  fired: '#5fc4a0',
  'cleanup-pending': '#b99be8',
  'cleaned-up': '#85858b',
};

const STATUS_BG: Record<EffectStatus, string> = {
  scheduled: 'rgba(245, 158, 11, 0.12)',
  fired: 'rgba(34, 197, 94, 0.12)',
  'cleanup-pending': 'rgba(249, 115, 22, 0.12)',
  'cleaned-up': 'rgba(107, 114, 128, 0.1)',
};

export default function EffectsPanel() {
  const effects = useEffectsList();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">Effects Queue</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {!effects || effects.length === 0 ? (
          <EmptyState />
        ) : (
          effects.map((effect) => <EffectRow key={effect.id} effect={effect} />)
        )}
      </div>
    </div>
  );
}

function EffectRow({ effect }: { effect: EffectSnapshot }) {
  const { id, deps, status } = effect;
  const color = STATUS_COLORS[status];
  const bg = STATUS_BG[status];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '5px 10px',
        borderBottom: '1px solid var(--border)',
        gap: '3px',
        fontFamily: 'var(--mono)',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{id}</span>
        {/* Status badge */}
        <span
          style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: '3px',
            background: bg,
            color,
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            border: `1px solid ${color}40`,
          }}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      {/* Deps */}
      <div>
        <span style={{ color: 'var(--text-muted)' }}>deps: </span>
        <span style={{ color: '#e0b15a' }}>
          [{deps.length === 0 ? '' : deps.join(', ')}]
        </span>
      </div>
      {/* Visual status track */}
      <StatusTrack status={status} />
    </div>
  );
}

// A tiny progress-track visual showing where we are in the effect lifecycle
function StatusTrack({ status }: { status: EffectStatus }) {
  const stages: EffectStatus[] = ['scheduled', 'fired', 'cleanup-pending', 'cleaned-up'];
  const currentIdx = stages.indexOf(status);

  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', marginTop: '2px' }}>
      {stages.map((stage, i) => (
        <div
          key={stage}
          style={{
            height: '3px',
            flex: 1,
            borderRadius: '2px',
            background:
              i <= currentIdx
                ? STATUS_COLORS[stage]
                : 'var(--bg-elevated)',
            opacity: i <= currentIdx ? 1 : 0.4,
            transition: 'background 200ms',
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '10px',
        color: 'var(--text-muted)',
        fontSize: '12px',
        fontFamily: 'var(--mono)',
      }}
    >
      — no effects —
    </div>
  );
}
