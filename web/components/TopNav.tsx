'use client';

import type { Trace } from '@/types/trace';
import { useStore } from '@/store';

interface Props {
  trace: Trace;
}

export default function TopNav({ trace }: Props) {
  const audience = useStore((s) => s.audience);
  const setAudience = useStore((s) => s.setAudience);
  const openPopover = useStore((s) => s.openPopover);

  const { category, hook, title } = trace.meta;

  // Derive a short example label from title (strip the "hook — " prefix)
  const exampleLabel = title.replace(/^[^—]+—\s*/, '');

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 'var(--nav-height)',
        padding: '0 12px',
        background: 'var(--bg-surface)',
        borderBottom: 'var(--panel-border)',
        gap: '8px',
        userSelect: 'none',
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Wordmark / root breadcrumb */}
      <button
        className="breadcrumb-btn"
        onClick={() => openPopover('root')}
        style={breadcrumbStyle}
        title="All examples"
      >
        HookViz
      </button>

      <Separator />

      {/* Category */}
      <button
        className="breadcrumb-btn"
        onClick={() => openPopover('category')}
        style={breadcrumbStyle}
        title={`All ${category} examples`}
      >
        {category}
      </button>

      <Separator />

      {/* Hook */}
      <button
        className="breadcrumb-btn"
        onClick={() => openPopover('hook')}
        style={breadcrumbStyle}
        title={`All ${hook} examples`}
      >
        {hook}
      </button>

      <Separator />

      {/* Current example */}
      <button
        className="breadcrumb-btn"
        onClick={() => openPopover('example')}
        style={{ ...breadcrumbStyle, color: 'var(--text-primary)' }}
        title="Other examples for this hook"
      >
        {exampleLabel}
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Guided / Expert toggle */}
      <button
        onClick={() => setAudience(audience === 'guided' ? 'expert' : 'guided')}
        title={audience === 'guided' ? 'Switch to Expert mode' : 'Switch to Guided mode'}
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: audience === 'guided' ? 'var(--accent)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: '13px',
          padding: '2px 8px',
          lineHeight: 1.6,
          transition: 'color 100ms, border-color 100ms',
        }}
      >
        {audience === 'guided' ? '◑ Guided' : '◐ Expert'}
      </button>

      {/* ⌘K placeholder */}
      <button
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: '12px',
          padding: '2px 8px',
          lineHeight: 1.6,
        }}
        title="Command palette (coming soon)"
      >
        ⌘K
      </button>
    </nav>
  );
}

function Separator() {
  return (
    <span style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1 }}>
      /
    </span>
  );
}

const breadcrumbStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'var(--sans)',
  fontSize: '13px',
  padding: '2px 4px',
  borderRadius: '3px',
  lineHeight: 1.5,
};
