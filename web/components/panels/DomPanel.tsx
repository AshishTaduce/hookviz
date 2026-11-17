'use client';

import { useRef, useEffect, useState } from 'react';
import { useDomHtml, useStore } from '@/store';

// Minimal reset injected into the iframe for clean presentation
const RESET_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    background: #141415;
    color: #ededed;
  }
  button {
    background: #232325;
    color: #ededed;
    border: 1px solid rgba(237,237,237,0.16);
    border-radius: 8px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover { background: #2b2b2e; }
`;

function wrapHtml(dom: string): string {
  return `<!doctype html><html><head><style>${RESET_CSS}</style></head><body>${dom}</body></html>`;
}

export default function DomPanel() {
  const dom = useDomHtml();
  const stepIndex = useStore((s) => s.stepIndex);

  // Carry-forward ref: hold last non-null dom
  const lastDomRef = useRef<string | null>(null);
  const lastWrappedRef = useRef<string | null>(null);

  // Flash state: incremented when a new commit dom arrives
  const [flashKey, setFlashKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update carry-forward and trigger flash when new dom arrives
  useEffect(() => {
    if (dom !== null && dom !== lastDomRef.current) {
      lastDomRef.current = dom;
      const wrapped = wrapHtml(dom);
      lastWrappedRef.current = wrapped;
      if (iframeRef.current) {
        iframeRef.current.srcdoc = wrapped;
      }
      setFlashKey((k) => k + 1);
    }
  }, [dom, stepIndex]);

  const currentWrapped = lastWrappedRef.current;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">Rendered Output</div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {currentWrapped ? (
          <iframe
            key={`iframe`}
            ref={iframeRef}
            sandbox=""
            srcDoc={currentWrapped}
            title="Rendered DOM output"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
            className={flashKey > 0 ? 'dom-flash' : undefined}
            // Reset animation on each new commit by forcing a re-apply
            // The animation is defined in globals.css
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontFamily: 'var(--mono)',
            }}
          >
            no commit yet
          </div>
        )}
        {/* Flash overlay — re-keyed on each new dom to retrigger the CSS animation */}
        {flashKey > 0 && (
          <FlashOverlay key={flashKey} />
        )}
      </div>
    </div>
  );
}

// A transparent overlay that animates an amber border flash on commit
function FlashOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        animation: 'dom-flash 500ms ease-out forwards',
      }}
    />
  );
}
