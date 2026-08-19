'use client';

import { useHooks } from '@/store';
import type { HookSnapshot } from '@/types/trace';

export default function HooksPanel() {
  const hooks = useHooks();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">Hooks (fiber linked list)</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {!hooks || hooks.length === 0 ? (
          <EmptyState />
        ) : (
          <div>
            {hooks.map((hook) => (
              <HookRow key={hook.index} hook={hook} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HookRow({ hook }: { hook: HookSnapshot }) {
  const { index, type, memoized, queue, deps, changed } = hook;

  return (
    <div
      className={changed ? 'changed-row' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '5px 10px',
        borderBottom: '1px solid var(--border)',
        gap: '2px',
        fontFamily: 'var(--mono)',
        fontSize: '12px',
      }}
    >
      {/* Header row: index + type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Linked-list index node indicator */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            fontSize: '10px',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {index}
        </span>
        {/* Arrow representing linked-list pointer */}
        {index > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '-4px' }}>
            ←
          </span>
        )}
        <span style={{ color: '#4fc1ff', fontWeight: 600 }}>{type}</span>
        {changed && (
          <span
            style={{
              fontSize: '9px',
              background: 'rgba(255, 200, 0, 0.2)',
              color: '#ffc800',
              borderRadius: '2px',
              padding: '0 4px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            CHANGED
          </span>
        )}
      </div>

      {/* Memoized value */}
      <div style={{ paddingLeft: '26px', color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--text-muted)' }}>memoized: </span>
        <span style={{ color: '#9cdcfe' }}>{memoized}</span>
      </div>

      {/* Queue (only if non-empty) */}
      {queue.length > 0 && (
        <div style={{ paddingLeft: '26px' }}>
          <span style={{ color: 'var(--text-muted)' }}>queue: </span>
          <span style={{ color: '#f59e0b' }}>[{queue.join(', ')}]</span>
        </div>
      )}

      {/* Deps (only if non-null) */}
      {deps !== null && (
        <div style={{ paddingLeft: '26px' }}>
          <span style={{ color: 'var(--text-muted)' }}>deps: </span>
          <span style={{ color: '#ce9178' }}>[{deps.join(', ')}]</span>
        </div>
      )}
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
      — no hooks yet —
    </div>
  );
}
