'use client';

import type { Trace } from '@/types/trace';
import Link from 'next/link';
import { useStore } from '@/store';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';

interface Props {
  trace: Trace;
}

export default function TopNav({ trace }: Props) {
  const audience = useStore((s) => s.audience);
  const setAudience = useStore((s) => s.setAudience);
  const openPopover = useStore((s) => s.openPopover);
  const fontSize = useStore((s) => s.fontSize);
  const increaseFontSize = useStore((s) => s.increaseFontSize);
  const decreaseFontSize = useStore((s) => s.decreaseFontSize);

  const { category, hook, title } = trace.meta;

  // Derive a short example label from title (strip the "hook — " prefix)
  const exampleLabel = title.replace(/^[^—]+—\s*/, '');

  // Only show category when it's a real grouping, not just the hook slug
  const showCategory = category.toLowerCase() !== hook.toLowerCase();

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 'var(--nav-height)',
        padding: '0 16px',
        background: 'var(--bg-surface)',
        borderBottom: 'var(--panel-border)',
        gap: '8px',
        userSelect: 'none',
        position: 'relative',
        zIndex: 100,
      }}
    >
      <div className="stripe" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <i />
        <i />
        <i />
        <i />
      </div>

      {/* Wordmark links home; the breadcrumb below lists all examples */}
      <Link href="/" style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 15, textDecoration: 'none', padding: '2px 4px' }}>
        HookViz
      </Link>
      <Separator />
      <button
        className="breadcrumb-btn"
        onClick={() => openPopover('root')}
        style={breadcrumbStyle}
        title="All examples"
      >
        Examples
      </button>

      <Separator />

      {/* Category — only shown when it differs from the hook slug */}
      {showCategory && (
        <>
          <button
            className="breadcrumb-btn"
            onClick={() => openPopover('category')}
            style={breadcrumbStyle}
            title={`All ${category} examples`}
          >
            {category}
          </button>
          <Separator />
        </>
      )}

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
          borderRadius: '8px',
          color: audience === 'guided' ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: '13px',
          padding: '4px 10px',
          lineHeight: 1.5,
          transition: 'color 150ms var(--ease), border-color 150ms var(--ease)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name={audience === 'guided' ? 'guided' : 'expert'} size={14} />{audience === 'guided' ? 'Guided' : 'Expert'}</span>
      </button>

      {/* Font size controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <button
          onClick={decreaseFontSize}
          disabled={fontSize <= 10}
          title="Decrease font size"
          style={{ ...zoomBtnStyle, opacity: fontSize <= 10 ? 0.3 : 1 }}
        >
          −
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '24px', textAlign: 'center' }}>
          {fontSize}
        </span>
        <button
          onClick={increaseFontSize}
          disabled={fontSize >= 20}
          title="Increase font size"
          style={{ ...zoomBtnStyle, opacity: fontSize >= 20 ? 0.3 : 1 }}
        >
          +
        </button>
      </div>

      <Link href="/guide" style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', padding: '4px 8px' }}>
        Guide
      </Link>
      <ThemeToggle />
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

const zoomBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontFamily: 'var(--sans)',
  fontSize: '11px',
  padding: '2px 5px',
  borderRadius: '3px',
  lineHeight: 1.5,
};

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
