'use client';

import { useVariables } from '@/store';
import type { Variable } from '@/types/trace';

const KIND_COLORS: Record<string, string> = {
  number: '#b5cea8',
  string: '#ce9178',
  boolean: '#569cd6',
  function: '#dcdcaa',
  object: '#9cdcfe',
  undefined: '#6b7280',
  null: '#6b7280',
};

export default function VariablesPanel() {
  const variables = useVariables();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">Variables</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {!variables || variables.length === 0 ? (
          <EmptyState />
        ) : (
          variables.map((v) => <VariableRow key={v.name} variable={v} />)
        )}
      </div>
    </div>
  );
}

function VariableRow({ variable }: { variable: Variable }) {
  const { name, value, kind, changed } = variable;
  const valueColor = KIND_COLORS[kind] ?? 'var(--text-primary)';

  return (
    <div
      className={changed ? 'changed-row' : undefined}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        padding: '4px 10px',
        borderBottom: '1px solid var(--border)',
        gap: '6px',
        fontFamily: 'var(--mono)',
        fontSize: '12px',
      }}
    >
      {/* Kind pill */}
      <span
        style={{
          fontSize: '9px',
          color: 'var(--text-muted)',
          background: 'var(--bg-elevated)',
          borderRadius: '2px',
          padding: '0 4px',
          flexShrink: 0,
          lineHeight: '14px',
        }}
      >
        {kind}
      </span>

      {/* Name */}
      <span style={{ color: '#9cdcfe', flex: '0 0 auto' }}>{name}</span>

      <span style={{ color: 'var(--text-muted)' }}>=</span>

      {/* Value */}
      <span
        style={{
          color: valueColor,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={value}
      >
        {value}
      </span>

      {/* Changed indicator */}
      {changed && (
        <span
          style={{
            fontSize: '9px',
            background: 'rgba(255, 200, 0, 0.2)',
            color: '#ffc800',
            borderRadius: '2px',
            padding: '0 4px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          !
        </span>
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
      — no variables —
    </div>
  );
}
